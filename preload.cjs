const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tayefsDesktop", {
  saveBackup: payload => ipcRenderer.invoke("tayefs:save-backup", payload)
});
