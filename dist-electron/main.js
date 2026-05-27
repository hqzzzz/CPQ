import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { execSync } from "child_process";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const isDev = process.env.NODE_ENV === "development";
if (process.platform === "win32") {
  try {
    execSync("chcp.com 65001", { stdio: "ignore" });
  } catch {
  }
}
const getVitePort = () => {
  try {
    const portPath = path.join(__dirname$1, "../.vite-port");
    if (fs.existsSync(portPath)) {
      return fs.readFileSync(portPath, "utf-8").trim();
    }
  } catch {
  }
  return "3000";
};
const VITE_PORT = getVitePort();
function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (isDev) {
    const viteUrl = `http://localhost:${VITE_PORT}`;
    console.log(`Electron 连接到 Vite 服务器：${viteUrl}`);
    window.loadURL(viteUrl);
  } else {
    window.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
