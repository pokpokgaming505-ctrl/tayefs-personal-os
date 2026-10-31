const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const APP_ID = "com.northstar.lifeos";
app.setAppUserModelId(APP_ID);

function createWindow() {
  const win = new BrowserWindow({
    width: 1260,
    height: 850,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: "#10120f",
    autoHideMenuBar: true,
    title: "Northstar | Personal OS",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadFile(path.join(__dirname, "www", "index.html"));
}

ipcMain.handle("northstar:save-backup", async (_event, payload) => {
  if (!payload || typeof payload.json !== "string" || payload.json.length > 20_000_000) {
    throw new Error("Invalid backup data.");
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save Northstar backup",
    defaultPath: path.basename(String(payload.filename || "northstar-backup.json")),
    filters: [{ name: "JSON backup", extensions: ["json"] }]
  });
  if (canceled || !filePath) return { saved: false };
  await fs.writeFile(filePath, payload.json, { encoding: "utf8", flag: "w" });
  return { saved: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
