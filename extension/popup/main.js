let psshs=chrome.extension.getBackgroundPage().psshs;
let requests=chrome.extension.getBackgroundPage().requests;
let pageURL=chrome.extension.getBackgroundPage().pageURL;
let targetIds=chrome.extension.getBackgroundPage().targetIds;
let clearkey=chrome.extension.getBackgroundPage().clearkey;

async function guess(){
    //Be patient!
    document.body.style.cursor = "wait";
    document.getElementById("guess").disabled=true

    //Init Pyodide
    let pyodide = await loadPyodide();
    await pyodide.loadPackage(["certifi-2024.2.2-py3-none-any.whl","charset_normalizer-3.3.2-py3-none-any.whl","construct-2.8.8-py2.py3-none-any.whl","idna-3.6-py3-none-any.whl","packaging-23.2-py3-none-any.whl","protobuf-4.24.4-cp312-cp312-emscripten_3_1_52_wasm32.whl","pycryptodome-3.20.0-cp35-abi3-emscripten_3_1_52_wasm32.whl","pymp4-1.4.0-py2.py3-none-any.whl","pyodide_http-0.2.1-py3-none-any.whl","pywidevine-1.8.0-py3-none-any.whl","requests-2.31.0-py3-none-any.whl","urllib3-2.2.1-py3-none-any.whl"].map(e=>"/libs/wheels/"+e))

    //Configure Guesser
    pyodide.globals.set("pssh", document.getElementById('pssh').value);
    pyodide.globals.set("licUrl", requests[userInputs['license']]['url']);
    pyodide.globals.set("licHeaders", requests[userInputs['license']]['headers']);
    pyodide.globals.set("licBody", requests[userInputs['license']]['body']);
    let pre = await fetch('/python/pre.py').then(res=>res.text())
    let after = await fetch('/python/after.py').then(res=>res.text())
    let scheme = document.getElementById("schemeCode").value

    //Get result
    let result = await pyodide.runPythonAsync([pre, scheme, after].join("\n"));
    document.getElementById('result').value=result;

    //Save history
    let historyData={
        PSSH: document.getElementById('pssh').value,
        KEYS: result.split("\n").slice(0,-1)
    }
    chrome.storage.local.set({[pageURL]: historyData}, null);

    //All Done!
    document.body.style.cursor = "auto";
    document.getElementById("guess").disabled=false
}

function copyResult(){
    this.select();
    navigator.clipboard.writeText(this.value);
}

window.corsFetch = (u, m, h, b) => {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(targetIds[0], {type:"FETCH", u:u, m:m, h:h, b:b}, {frameId:targetIds[1]}, res => {
            resolve(res)
        })
    })
}

async function autoSelect(){
    userInputs["license"]=0;
    document.getElementById("license").value=requests[0]['url'];
    document.getElementById('pssh').value=psshs[0];
    
    let selectRules = await fetch("/selectRules.conf").then((r)=>r.text());
    //Remove blank lines, comment-outs, and trailing spaces at the end of lines
    selectRules = selectRules.replace(/\n^\s*$|\s*\/\/.*|\s*$/gm, "");
    selectRules = selectRules.split("\n").map(row => row.split("$$"));
    for(var item of selectRules){
        let search = requests.map(r => r['url']).findIndex(e => e.includes(item[0]));
        if(search>=0){
            if(item[1]) document.getElementById("schemeSelect").value = item[1];
            userInputs["license"]=search;
            document.getElementById("license").value=requests[search]['url'];
            break;
        }
    }

    document.getElementById("schemeSelect").dispatchEvent(new Event("input"))
}

if (clearkey) {
    document.getElementById('noEME').style.display = 'none';
    document.getElementById('ckHome').style.display = 'grid';
    document.getElementById('ckResult').value = clearkey;
    document.getElementById('ckResult').addEventListener("click", copyResult);
} else if (psshs.length) {
    document.getElementById('noEME').style.display = 'none';
    document.getElementById('home').style.display = 'grid';
    document.getElementById('guess').addEventListener("click", guess);
    document.getElementById('result').addEventListener("click", copyResult);
    autoSelect();
}

// ==========================================
// LÓGICA DA AUTOMAÇÃO EM MASSA
// ==========================================
const startBtn = document.getElementById('startAutomationBtn');
if (startBtn) {
    startBtn.addEventListener('click', () => {
        let textarea = document.getElementById('urlsInput');
        if (!textarea) {
            alert("Erro: Campo de texto não encontrado no HTML.");
            return;
        }
        
        let raw = textarea.value.trim();
        console.log("Texto digitado:", raw); // Ajuda a debugar no console (F12)
        
        if (!raw) {
            alert("O campo está vazio. Cole os sites separados por vírgula.");
            return;
        }

        // Separa por vírgula e remove espaços extras
        let urls = raw.split(',').map(u => u.trim()).filter(u => u !== '');
        
        if (urls.length > 0) {
            document.getElementById('automationStatus').innerText = `Automação iniciada para ${urls.length} sites! Aguarde o arquivo .txt...`;
            
            // Envia a mensagem para o background.js de forma segura
            chrome.runtime.sendMessage({ action: 'start_check', urls: urls });
        } else {
            alert("Nenhuma URL válida encontrada.");
        }
    });
}