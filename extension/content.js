const script = document.createElement('script');
script.type = 'text/javascript';
script.defer = false;
script.async = false;
script.src = chrome.runtime.getURL("inject.js");
(document.head || document.documentElement).appendChild(script);

//Reset variables at every page load in background.js
if (window === window.parent){
    chrome.runtime.sendMessage({type: "RESET"},null);
}

//Send PSSH into background.js
document.addEventListener('pssh', (e) => {
    chrome.runtime.sendMessage({
        type: "PSSH",
        text: e.detail
    },null);
});

//Send Clearkey into background.js
document.addEventListener('clearkey', (e) => {
    chrome.runtime.sendMessage({
        type: "CLEARKEY",
        text: e.detail
    },null);
});

// Função para simular a sequência exata de cliques humanos
function simularCliqueHumano(element) {
    if (!element) return;
    
    // Pega as coordenadas do centro do elemento
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + (rect.width / 2);
    const clientY = rect.top + (rect.height / 2);

    const options = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY
    };

    // Dispara a sequência
    element.dispatchEvent(new PointerEvent('pointerdown', options));
    element.dispatchEvent(new MouseEvent('mousedown', options));
    element.dispatchEvent(new PointerEvent('pointerup', options));
    element.dispatchEvent(new MouseEvent('mouseup', options));
    element.dispatchEvent(new MouseEvent('click', options));
}

// Tenta dar Play automaticamente APENAS se for a aba da automação
window.addEventListener('load', () => {
    setInterval(() => {
        // Pergunta ao background se esta aba é a da automação
        chrome.runtime.sendMessage({ type: "CHECK_AUTOMATION" }, (response) => {
            if (response && response.isAutomation) {
                let video = document.querySelector('video');
                
                // 1. Tenta dar play na tag de vídeo padrão
                if (video && video.paused) {
                    video.muted = true;
                    let playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {});
                    }
                    video.click();
                }
                
                // 2. Verifica se o .player-poster está visível e dispara a sequência
                let poster = document.querySelector('.player-poster');
                if (poster) {
                    // Verifica se o elemento realmente está visível na tela
                    const style = window.getComputedStyle(poster);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        simularCliqueHumano(poster);
                    }
                }
                
                // 3. Fallback para outros botões de play conhecidos
                let playBtn = document.querySelector(`
                    .play-wrapper, 
                    .play-button, 
                    .vjs-big-play-button, 
                    button[aria-label="Play"],
                    .ytp-large-play-button
                `);
                
                if (playBtn && (!video || video.paused)) {
                    const btnStyle = window.getComputedStyle(playBtn);
                    if (btnStyle.display !== 'none' && btnStyle.visibility !== 'hidden') {
                        simularCliqueHumano(playBtn);
                    }
                }
            }
        });
    }, 1500); // Verifica a cada 1,5 segundos
});

//Fetch from original origin
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if(request.type=="FETCH"){
            let res = fetch(request.u, {
                method: request.m,
                headers: JSON.parse(request.h),
                body: Uint8Array.from(atob(request.b), c => c.charCodeAt(0))
            }).then((r)=>r.arrayBuffer()).then((r)=>{
                sendResponse(
                    btoa(String.fromCharCode(...new Uint8Array(r)))
                );
            })
        }
        return true
    }
);