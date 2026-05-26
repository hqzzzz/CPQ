import { contextBridge } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  // 在这里添加你需要的 IPC 通信方法
  // 例如：send: (channel: string, data: any) => ipcRenderer.send(channel, data)
  //       receive: (channel: string, func: Function) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});
