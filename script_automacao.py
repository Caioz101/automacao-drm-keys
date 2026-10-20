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

def main():
    urls = get_urls()
    if not urls:
        print("ERRO: Nenhuma URL encontrada no lista_urls.txt")
        return

    ext_path = str(EXTENSION_PATH)
    
    print("Iniciando navegador Clearcote...")
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
        print("Navegador aberto. Procurando o ID da extensão...")
        page = browser.new_page()
        
        # Vai para a página de extensões para descobrir o ID da nossa extensão
        page.goto("chrome://extensions/")
        time.sleep(3)
        
        ext_id = page.evaluate("() => document.querySelector('extensions-manager').extensions_[0].id")
        
        if not ext_id:
            raise RuntimeError("Não foi possível encontrar o ID da extensão. Verifique se ela carregou.")
            
        print(f"ID da Extensão encontrado: {ext_id}")
        
        # Abre o popup da extensão para usar como "ponte" de comunicação
        page.goto(f"chrome-extension://{ext_id}/popup/main.html")
        time.sleep(2)

        print(f"Enviando comando para iniciar automação de {len(urls)} URLs...")
        
        # Usa a API de mensagens do Chrome (muito mais confiável no Clearcote)
        page.evaluate(f"""
            () => {{
                return new Promise((resolve, reject) => {{
                    chrome.runtime.sendMessage({{ action: 'start_check', urls: {json.dumps(urls)} }}, (response) => {{
                        if (chrome.runtime.lastError) {{
                            reject(chrome.runtime.lastError.message);
                        }} else {{
                            resolve(response);
                        }}
                    }});
                }});
            }}
        """)

        print("Comando enviado. Aguardando a captura das chaves (timeout de 3 minutos)...")

        # Loop de verificação
        deadline = time.time() + 180 # 3 minutos
        resultado = None

        while time.time() < deadline:
            resultado = page.evaluate("""
                () => new Promise((resolve) => {
                    chrome.storage.local.get(['automationResult', 'automationStatus'], (result) => {
                        if (result.automationStatus === 'finalizada') {
                            resolve(result.automationResult || { channels: {} });
                        } else {
                            resolve(null);
                        }
                    });
                })
            """)
            
            if resultado:
                print("Automação finalizada com sucesso!")
                break
                
            time.sleep(5) # Espera 5 segundos antes de checar de novo

        if resultado:
            RESULT_PATH.write_text(
                json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8"
            )
            print("Arquivo canais_com_chaves.json atualizado!")
        else:
            print("ERRO: Tempo limite esgotado. A automação não terminou em 3 minutos.")

    except Exception as e:
        print(f"OCORREU UM ERRO NO SCRIPT: {e}")
        raise e
    finally:
        browser.close()

if __name__ == "__main__":
    main()
