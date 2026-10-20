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

def wait_for_result(bg_page):
    deadline = time.time() + 900 # 15 minutos
    while time.time() < deadline:
        data = bg_page.evaluate("""
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
    print(f"Tentando carregar extensão do caminho: {ext_path}")

    # Verifica se o manifest.json está no lugar certo
    if not (EXTENSION_PATH / "manifest.json").exists():
        print("ERRO FATAL: O arquivo 'manifest.json' não foi encontrado dentro da pasta 'extension'.")
        print("Verifique se você não subiu a pasta 'extension/extension/' por engano.")
        return

    browser = launch_persistent_context(
        user_data_dir=str(ROOT / ".playwright-profile"),
        widevine=True,
        headless=False,
        args=[
            f"--disable-extensions-except={ext_path}",
            f"--load-extension={ext_path}",
            "--no-sandbox",
            "--disable-dev-shm-usage"
        ]
    )

    try:
        print("Aguardando a extensão carregar...")
        bg_page = None
        
        # Tenta achar a página de background por até 15 segundos
        for i in range(15):
            if browser.background_pages:
                for page in browser.background_pages:
                    if page.url.startswith("chrome-extension://"):
                        bg_page = page
                        break
            if bg_page:
                break
            time.sleep(1)

        # Se não achar, tenta procurar nas abas normais (fallback)
        if not bg_page:
            for page in browser.pages:
                if page.url.startswith("chrome-extension://"):
                    bg_page = page
                    break

        if not bg_page:
            print("ERRO: Não foi possível encontrar o background da extensão.")
            print("URLs das abas abertas no momento:", [p.url for p in browser.pages])
            raise RuntimeError("Background não encontrado. Verifique os arquivos da extensão.")

        print(f"Extensão carregada! Iniciando automação para {len(urls)} URLs...")
        bg_page.evaluate(f"window.iniciarAutomacao({json.dumps(urls)})")
        
        resultado = wait_for_result(bg_page)
        
        RESULT_PATH.write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8"
        )
        print("Automação finalizada e arquivo canais_com_chaves.json atualizado!")

    finally:
        browser.close()

if __name__ == "__main__":
    main()
