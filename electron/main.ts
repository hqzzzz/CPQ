import { app, BrowserWindow,Menu} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// 设置 Windows 控制台编码为 UTF-8
if (process.platform === 'win32') {
  try {
    execSync('chcp.com 65001', { stdio: 'ignore' });
  } catch {}
}

// 从 .vite-port 文件读取 Vite 实际使用的端口，默认 3000
const getVitePort = (): string => {
  try {
    const portPath = path.join(__dirname, '../.vite-port');
    if (fs.existsSync(portPath)) {
      return fs.readFileSync(portPath, 'utf-8').trim();
    }
  } catch {
    // 忽略读取错误
  }
  return '3000';
};

const VITE_PORT = getVitePort();

function createWindow() {
  //Menu.setApplicationMenu(null); // 隐藏菜单栏
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // 开发模式：连接到 Vite 开发服务器
    const viteUrl = `http://localhost:${VITE_PORT}`;
    console.log(`Electron 连接到 Vite 服务器：${viteUrl}`);
    window.loadURL(viteUrl);
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export {}