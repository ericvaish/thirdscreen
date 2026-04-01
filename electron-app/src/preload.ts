import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

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
})
