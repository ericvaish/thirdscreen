import { contextBridge, ipcRenderer } from "electron"

/**
 * Exposes a safe IPC bridge to the renderer process.
 * The renderer calls window.electronAPI.invoke(channel, data)
 * which maps to ipcMain.handle(channel, ...) in the main process.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
  platform: process.platform,
})
