const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("northstarDesktop", {
  saveBackup: payload => ipcRenderer.invoke("northstar:save-backup", payload)
});
