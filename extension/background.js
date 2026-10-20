(async () => {
window.psshs=[];
window.requests=[];
window.bodys=[];
window.targetIds=[];
window.pageURL="";
window.clearkey="";
window.manifestUrl=""; 
window.audioUrl="";

chrome.storage.local.get("isBlock", (value) => {
    window.isBlock = value.isBlock;
})

function convertHeaders(obj){
    return JSON.stringify(Object.fromEntries(obj.map(header => [header.name, header.value])))
}

window.blockRules = await fetch("blockRules.conf").then((r)=>r.text());
window.blockRules = window.blockRules.replace(/\n^\s*$|\s*\/\/.*|\s*$/gm, "").split("\n");
function testBlock(url) {
    return window.isBlock && window.blockRules.some(e => url.includes(e));
}

//Get URL and headers from POST requests
chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        if (details.method === "POST") {
            window.requests.push({
                url:details.url,
                headers:convertHeaders(details.requestHeaders),
                body:window.bodys.find((b) => b.id == details.requestId)?.body
            });
            if(testBlock(details.url)){
                return {cancel:true}
            }
        }
    },
    {urls: ["<all_urls>"]},
    ["requestHeaders", "blocking"]
);

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        const url = details.url;
        if (url.includes('.mp4') || url.includes('.ts') || url.includes('.m4s') || url.includes('cenc_video') || url.includes('init.')) return;

        if (url.includes('audio') && (url.includes('.m3u8') || url.includes('.mpd') || url.includes('cmaf-cenc'))) {
            window.audioUrl = url;
            return; 
        }
        if (url.includes('.m3u8') || url.includes('.mpd') || url.includes('ctr-all') || url.includes('cmaf-cenc')) {
            window.manifestUrl = url;
        }
    },
    { urls: ["<all_urls>"] }
);

//Receive messages
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action === 'start_check') {
            window.iniciarAutomacao(request.urls);
            sendResponse({status: 'started'});
            return true;
        }

        if (request.type === "CHECK_AUTOMATION") {
            if (window.abaAutomacao && sender.tab && sender.tab.id === window.abaAutomacao) {
                sendResponse({ isAutomation: true });
            } else {
                sendResponse({ isAutomation: false });
            }
            return true;
        }

        switch(request.type){
            case "RESET":
                window.psshs = [];
                window.requests = [];
                window.bodys = [];
                window.targetIds = [];
                window.clearkey = "";
                window.manifestUrl = "";
                window.audioUrl = "";
                break;
                
            case "PSSH":
                window.psshs.push(request.text)
                window.pageURL=sender.tab.url
                window.targetIds=[sender.tab.id, sender.frameId]
                break;
                
            case "CLEARKEY":
                window.clearkey = `"url": "${window.manifestUrl}",\n"audio": "${window.audioUrl}",\n${request.text}`;
                if (window.abaAutomacao && sender.tab && sender.tab.id === window.abaAutomacao) {
                    window.receberChave(sender.tab.id, "CLEARKEY", request.text);
                }
                break;
        }
    }
);
} )()

chrome.browserAction.onClicked.addListener(tab => {
    if(chrome.windows){
        chrome.windows.create({ url: "popup/main.html", type: "popup", width: 820, height: 600 });
    } else {
        chrome.tabs.create({url: 'popup/main.html'})
    }
});

function createMenu(){
    chrome.storage.local.set({'isBlock': false}, null);
    chrome.contextMenus.create({ id: "toggleBlocking", title: "Enable License Blocking" });
}
chrome.runtime.onInstalled.addListener(createMenu)
chrome.runtime.onStartup.addListener(createMenu)

chrome.contextMenus.onClicked.addListener(item => {
    if(item.menuItemId == "toggleBlocking"){
        chrome.storage.local.get("isBlock", (value) => {
            if(value.isBlock){
                chrome.storage.local.set({'isBlock': false}, null);
                chrome.contextMenus.update("toggleBlocking",{title: "Enable License Blocking"})
            } else {
                chrome.storage.local.set({'isBlock': true}, null);
                chrome.contextMenus.update("toggleBlocking",{title: "Disable License Blocking"})
            }
        })
    }
})

// ==========================================
// LÓGICA DA AUTOMAÇÃO E MAPEAMENTO DE CANAIS
// ==========================================

// PREENCHA AQUI O SEU MAPEAMENTO!
// Exemplo: "premiere2": "234" (O ID da URL vai ser a chave, e a numeração o valor)
// IDs das URLs → números dos canais no app.
// Sem YouTube e TV aberta. Inclui os IDs das fontes alternativas.
const channelMapping = {
    "sportv3": "37",
    "sportv3-2": "37",
    "sportv3-3": "37",
    "sportv2": "38",
    "sportv2-2": "38",
    "sportv2-3": "38",
    "sportv": "39",
    "sportv-2": "39",
    "sportv-3": "39",
    "globonews": "40",
    "globonews-2": "40",
    "gnt": "41",
    "gnt-2": "41",
    "multishow": "42",
    "multishow-2": "42",
    "discoverykids": "52",
    "discoverykids-2": "52",
    "gloob": "55",
    "gloob-2": "55",
    "gloobinho": "56",
    "gloobinho-2": "56",
    "tooncast": "59",
    "cartoonnetwork": "60",
    "cartoonnetwork-2": "60",
    "adultswim": "61",
    "adultswim-2": "61",
    "cartoonito": "62",
    "cartoonito-2": "62",
    "discoverychannel": "70",
    "discoverychannel-2": "70",
    "animalplanet": "71",
    "animalplanet-2": "71",
    "discoveryscience": "72",
    "discoveryscience-2": "72",
    "discoverytheater": "73",
    "discoverytheater-2": "73",
    "discoveryturbo": "74",
    "discoveryturbo-2": "74",
    "discoveryworld": "75",
    "discoveryworld-2": "75",
    "history": "76",
    "history2": "77",
    "foodnetwork": "82",
    "foodnetwork-2": "82",
    "discoveryheh": "85",
    "discoveryheh-2": "85",
    "tcpremium": "100",
    "tcaction": "101",
    "tctouch": "102",
    "tcpipoca": "103",
    "tcfun": "104",
    "tccult": "105",
    "megapix": "107",
    "megapix-2": "107",
    "megapix-3": "107",
    "tnt": "108",
    "tnt-2": "108",
    "tnt-3": "108",
    "space": "110",
    "space-2": "110",
    "space-3": "110",
    "studiouniversal": "111",
    "studiouniversal-2": "111",
    "cinemax": "112",
    "cinemax-2": "112",
    "amc": "114",
    "globoplaynovelas": "116",
    "globoplaynovelas-2": "116",
    "tntnovelas": "118",
    "tntnovelas-2": "118",
    "tntseries": "119",
    "tntseries-2": "119",
    "hbo": "120",
    "hbo2": "121",
    "hboplus": "122",
    "hbofamily": "124",
    "hbosignature": "125",
    "hbopop": "127",
    "hboxtreme": "128",
    "axn": "136",
    "sony": "137",
    "aee": "138",
    "warner": "139",
    "warner-2": "139",
    "universaltv": "140",
    "universaltv-2": "140",
    "discoveryid": "149",
    "discoveryid-2": "149",
    "mtv": "159",
    "bandnews": "171",
    "bandnews-2": "171",
    "combate": "190",
    "combate-2": "190",
    "espn": "200",
    "espn-2": "200",
    "espn-3": "200",
    "espn2": "201",
    "espn2-2": "201",
    "espn2-3": "201",
    "espn3": "202",
    "espn3-2": "202",
    "espn3-3": "202",
    "espn4": "203",
    "espn4-2": "203",
    "espn4-3": "203",
    "espn5": "204",
    "espn5-2": "204",
    "espn6": "205",
    "espn6-2": "205",
    "bandsports": "210",
    "bandsports-2": "210",
    "bandsports-3": "210",
    "bandsports-4": "210",
    "premiere": "233",
    "premiere-2": "233",
    "premiere-3": "233",
    "premiere2": "234",
    "premiere2-2": "234",
    "premiere2-3": "234",
    "premiere3": "235",
    "premiere3-2": "235",
    "premiere3-3": "235",
    "premiere4": "236",
    "premiere4-2": "236",
    "premiere4-3": "236",
    "premiere5": "237",
    "premiere5-2": "237",
    "premiere5-3": "237",
    "premiere6": "238",
    "premiere6-2": "238",
    "premiere6-3": "238",
    "premiere7": "239",
    "premiere7-2": "239",
    "premiere7-3": "239",
    "cnnbrasil": "300",
    "cnnbrasil-2": "300",
    "cnnbrasil-3": "300",
    "primevideo": "600",
    "primevideo1": "600",
    "primevideo1-2": "600",
    "primevideo1-3": "600",
    "primevideo2": "601",
    "primevideo2-2": "601",
    "max1": "627",
    "max1-2": "627",
    "max1-3": "627",
    "max2": "628",
    "max2-2": "628",
    "max3": "629",
    "max3-2": "629",
    "max4": "630",
    "max4-2": "630",
    "max5": "631",
    "max5-2": "631",
    "max6": "632",
    "max6-2": "632",
    "paramount1": "633",
    "paramount1-2": "633",
    "paramount1-3": "633",
    "paramount1-4": "633",
    "paramount1-5": "633",
    "paramount1-6": "633",
    "paramount2": "634",
    "paramount2-2": "634"
};

window.filaDeUrls = [];
window.resultadosAutomacao = [];
window.abaAutomacao = null;
window.checkTimeout = null;
window.currentUrl = null;
window.currentKeys = [];

window.iniciarAutomacao = function(listaDeUrls) {
    window.filaDeUrls = listaDeUrls;
    window.resultadosAutomacao = [];
    window.abaAutomacao = null;
    window.currentUrl = null;
    window.currentKeys = [];
    console.log("[Automação] Iniciada para " + listaDeUrls.length + " links.");
    processarProximaUrl();
}

function salvarResultadoAtual() {
    if (window.currentUrl && window.currentKeys.length > 0) {
        window.resultadosAutomacao.push({
            site: window.currentUrl,
            chaves: window.currentKeys
        });
        console.log(`[Automação] Salvo: ${window.currentUrl}`);
    }
    window.currentUrl = null;
    window.currentKeys = [];
}

function processarProximaUrl() {
    clearTimeout(window.checkTimeout);
    salvarResultadoAtual();
    
function exportarResultados() {
    // ... (mantenha todo o código de formatação do JSON que já está aí) ...

    // Substitua a parte do chrome.downloads.download por isso:
    chrome.storage.local.set({
        automationResult: jsonOutput,
        automationStatus: 'finalizada'
    }, () => {
        console.log('[Automação] Resultado salvo no storage.');
    });

    if (window.abaAutomacao) {
        chrome.tabs.remove(window.abaAutomacao);
        window.abaAutomacao = null;
    }
}
    
    window.currentUrl = window.filaDeUrls.shift();
    console.log("[Automação] A acessar: " + window.currentUrl);
    window.manifestUrl = ""; 
    window.audioUrl = "";
    
    window.checkTimeout = setTimeout(() => {
        console.log("[Automação] Tempo esgotado: " + window.currentUrl);
        processarProximaUrl(); 
    }, 5000);

    if (window.abaAutomacao) {
        chrome.tabs.update(window.abaAutomacao, { url: window.currentUrl }, () => {
            window.currentKeys = [];
        });
    } else {
        chrome.tabs.create({ url: window.currentUrl }, function(tab) {
            window.abaAutomacao = tab.id;
        });
    }
}

window.receberChave = function(tabId, tipo, dados) {
    if (!window.abaAutomacao || tabId !== window.abaAutomacao) return;
    if (window.currentKeys.some(k => k.dados === dados)) return;

    window.currentKeys.push({ 
        tipo: tipo, 
        dados: dados,
        manifestUrl: window.manifestUrl,
        audioUrl: window.audioUrl
    });
    
    if (window.currentKeys.length > 0) {
        clearTimeout(window.checkTimeout);
        window.checkTimeout = setTimeout(() => {
            processarProximaUrl();
        }, 1500);
    }
}

function exportarResultados() {
    let jsonOutput = { channels: {} };

    window.resultadosAutomacao.forEach(res => {
        // Tenta extrair o 'id' da URL (ex: watch.html?id=premiere2)
        let channelId = null;
        try {
            let urlObj = new URL(res.site);
            let idParam = urlObj.searchParams.get('id');
            if (idParam) {
                // Se o ID estiver no mapeamento, usa o número do canal. Senão, usa o próprio ID.
                channelId = channelMapping[idParam] || idParam; 
            }
        } catch (e) {}

        if (!channelId) {
            // Fallback se não achar a URL, usa o nome do canal ou a URL inteira
            channelId = res.site.split('id=')[1] || res.site;
        }

        if (!jsonOutput.channels[channelId]) {
            jsonOutput.channels[channelId] = { sources: [] };
        }

        res.chaves.forEach(c => {
            if (c.tipo === "CLEARKEY") {
                let kid = "";
                let key = "";
                
                // Extrai o KID e a Key da string que veio do inject.js
                let matchKID = c.dados.match(/"clearKeyKid":\s*"([^"]+)"/);
                let matchKey = c.dados.match(/"clearKey":\s*"([^"]+)"/);
                
                if (matchKID) kid = matchKID[1];
                if (matchKey) key = matchKey[1];

                let manifest = c.manifestUrl || res.site;
                let kind = "HLS"; // Padrão

                if (manifest.includes(".mpd")) {
                    kind = "DASH";
                } else if (manifest.includes(".m3u8") || manifest.includes(".txt")) {
                    kind = "HLS";
                }

                jsonOutput.channels[channelId].sources.push({
                    provider: "autorizada",
                    enabled: true,
                    kind: kind,
                    url: manifest,
                    clearKeyKid: kid,
                    clearKey: key,
                    audioUrl: c.audioUrl || ""
                });
            }
        });
    });

    // Transforma em texto formatado (JSON bonito)
    let texto = JSON.stringify(jsonOutput, null, 2);
    if (Object.keys(jsonOutput.channels).length === 0) {
        texto = "Nenhuma chave foi capturada nos sites fornecidos.";
    }
    
    let blob = new Blob([texto], {type: "application/json"});
    let url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
        url: url,
        filename: "canais_com_chaves.txt", // Salva como txt mas o conteúdo é JSON
        saveAs: false 
    });
    
    if (window.abaAutomacao) {
        chrome.tabs.remove(window.abaAutomacao);
        window.abaAutomacao = null;
    }
}