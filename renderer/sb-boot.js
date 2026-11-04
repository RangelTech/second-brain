// Liga window.sb ao canal do app: IPC do Electron no app instalado, WebSocket na versão web (sb-web.js define __sbRaw antes deste arquivo).
window.sb = window.criarSb(window.__sbRaw.invoke, window.__sbRaw.on, { caminhoDe: window.__sbRaw.caminhoDe, abrirExterno: window.__sbRaw.abrirExterno })
