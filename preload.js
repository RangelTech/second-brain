const { contextBridge, ipcRenderer, webUtils } = require('electron')

// Só o canal bruto. A interface monta window.sb com renderer/sb-api.js (o mesmo arquivo que a versão web usa),
// porque o preload roda em sandbox e não pode carregar outros arquivos.
contextBridge.exposeInMainWorld('__sbRaw', {
  invoke: (canal, ...args) => ipcRenderer.invoke(canal, ...args),
  on: (canal, fn) => ipcRenderer.on(canal, (_e, d) => fn(d)),
  caminhoDe: (arquivo) => webUtils.getPathForFile(arquivo),
})
