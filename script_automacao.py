import json
import os
import time
from pathlib import Path
from clearcote import launch_persistent_context

ROOT = Path(__file__).resolve().parent
EXTENSION_PATH = ROOT / "extension"
RESULT_PATH = ROOT / "canais_com_chaves.json"
URLS_PATH = ROOT / "lista_urls.txt"

def get_urls():
    if URLS_PATH.exists():
        content = URLS_PATH.read_text(encoding="utf-8").strip()
        if content:
            return [item.strip() for item in content.splitlines() if item.strip()]
    return []

def wait_for_result(page):
    deadline = time.time() + 900 # 15 minutos
    while time.time() < deadline:
        data = page.evaluate("""
            () => new Promise((resolve) => {
                const check = () => {
                    chrome.storage.local.get(['automationResult', 'automationStatus'], (result) => {
                        if (result.automationStatus === 'finalizada') {
                            resolve(result.automationResult || { channels: {} });
                            return;
                        }
                        setTimeout(check, 2000);
                    });
                };
                check();
            })
        """)
        if data:
            return data
        time.sleep(2)
    raise TimeoutError("Tempo limite excedido.")

def main():
    urls = get_urls()
    if not urls:
        print("ERRO: Nenhuma URL encontrada no lista_urls.txt")
        return

    ext_path = str(EXTENSION_PATH)
    
    browser = launch_persistent_context(
        user_data_dir=str(ROOT / ".playwright-profile"),
        widevine=True,
        headless=False,
        args=[
            f"--disable-extensions-except={ext_path}",
            f"--load-extension={ext_path}",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--enable-features=ExtensionManifestV2Availability"
        ]
    )

    try:
        print("Aguardando a extensão carregar...")
        bg_page = None
        
        # Tenta achar a página de background por até 10 segundos
        for i in range(10):
            if browser.background_pages:
                bg_page = browser.background_pages[0]
                break
            time.sleep(1)

        if bg_page:
            print("Background encontrado diretamente. Iniciando automação...")
            bg_page.evaluate(f"window.iniciarAutomacao({json.dumps(urls)})")
            result_page = bg_page
        else:
            print("Background não encontrado via API. Tentando abrir a página da extensão manualmente...")
            page = browser.new_page()
            page.goto("chrome://extensions/")
            time.sleep(2)
            ext_id = page.evaluate("() => document.querySelector('extensions-manager').extensions_[0].id")
            
            if not ext_id:
                raise RuntimeError("Não foi possível descobrir o ID da extensão.")
                
            print(f"ID da Extensão descoberto: {ext_id}")
            page.goto(f"chrome-extension://{ext_id}/popup/main.html")
            
            print(f"Iniciando automação para {len(urls)} URLs via popup...")
            # CORREÇÃO AQUI: Acessa a função dentro do contexto do Background
            page.evaluate(f"chrome.extension.getBackgroundPage().iniciarAutomacao({json.dumps(urls)})")
            result_page = page

        resultado = wait_for_result(result_page)
        
        RESULT_PATH.write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8"
        )
        print("Automação finalizada e arquivo canais_com_chaves.json atualizado!")

    finally:
        browser.close()

if __name__ == "__main__":
    main()
