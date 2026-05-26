// Electron 类型声明
export interface ElectronAPI {
  // 添加你需要的 IPC 通信方法
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}