import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  // Generic invoke for any IPC channel
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),

  // Native preferences
  getPreferences: () => ipcRenderer.invoke("native:get-preferences"),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke("native:set-always-on-top", value),
  setLaunchAtLogin: (value: boolean) => ipcRenderer.invoke("native:set-launch-at-login", value),

  // AppleScript bridge (macOS only)
  runAppleScript: (script: string) => ipcRenderer.invoke("native:applescript", script),

  // Open URL in default browser
  openExternal: (url: string) => ipcRenderer.invoke("native:open-external", url),

  // Native notification
  notify: (title: string, body: string) => ipcRenderer.invoke("native:notify", { title, body }),

  // AI engine event listeners
  onAIProgress: (handler: (event: unknown, data: unknown) => void) => {
    ipcRenderer.on("ai:progress", handler as (...args: unknown[]) => void)
  },
  offAIProgress: (handler: (event: unknown, data: unknown) => void) => {
    ipcRenderer.removeListener("ai:progress", handler as (...args: unknown[]) => void)
  },
  onAIToken: (handler: (event: unknown, token: string) => void) => {
    ipcRenderer.on("ai:token", handler as (...args: unknown[]) => void)
  },
  offAIToken: (handler: (event: unknown, token: string) => void) => {
    ipcRenderer.removeListener("ai:token", handler as (...args: unknown[]) => void)
  },
  onAIToolCall: (handler: (event: unknown, toolCall: unknown) => void) => {
    ipcRenderer.on("ai:tool-call", handler as (...args: unknown[]) => void)
  },
  offAIToolCall: (handler: (event: unknown, toolCall: unknown) => void) => {
    ipcRenderer.removeListener("ai:tool-call", handler as (...args: unknown[]) => void)
  },
  onAIExecuteTool: (handler: (event: unknown, data: unknown) => void) => {
    ipcRenderer.on("ai:execute-tool", handler as (...args: unknown[]) => void)
  },
  sendAIToolResult: (channel: string, result: string) => {
    ipcRenderer.send(channel, result)
  },
})
