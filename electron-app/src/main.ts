import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from "electron"
import path from "path"
import { exec } from "child_process"
import { registerAIHandlers } from "./ai-engine"

const IS_DEV = !app.isPackaged
const HOSTED_URL = "https://thirdscr.com/app"

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let alwaysOnTop = false
let isQuitting = false

// ── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 800,
    minHeight: 600,
    title: "Third Screen",
    titleBarStyle: "default",
    backgroundColor: "#1a1a2e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadURL(HOSTED_URL)
  }

  // Hide instead of close on macOS (click red button = hide, Cmd+Q = quit)
  mainWindow.on("close", (e) => {
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

function showWindow() {
  if (!mainWindow) {
    createWindow()
  } else if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  mainWindow?.focus()
}

function toggleWindow() {
  if (mainWindow?.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide()
  } else {
    showWindow()
  }
}

// ── Tray ────────────────────────────────────────────────────────────────────

function createTray() {
  // Use a template image for macOS menu bar (16x16, @2x = 32x32)
  const iconPath = IS_DEV
    ? path.join(__dirname, "..", "build", "trayTemplate.png")
    : path.join(process.resourcesPath, "trayTemplate.png")

  // Fallback: create a simple icon if file doesn't exist
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error("empty")
  } catch {
    // Create a tiny 16x16 placeholder
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip("Third Screen")

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Dashboard", click: showWindow },
    { type: "separator" },
    {
      label: "Always on Top",
      type: "checkbox",
      checked: alwaysOnTop,
      click: (item) => {
        alwaysOnTop = item.checked
        mainWindow?.setAlwaysOnTop(alwaysOnTop)
      },
    },
    {
      label: "Launch at Login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked })
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit() } },
  ])

  tray.setContextMenu(contextMenu)
  tray.on("click", toggleWindow)
}

// ── Menu ────────────────────────────────────────────────────────────────────

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Always on Top",
          type: "checkbox",
          checked: alwaysOnTop,
          accelerator: "CmdOrCtrl+Shift+T",
          click: (item) => {
            alwaysOnTop = item.checked
            mainWindow?.setAlwaysOnTop(alwaysOnTop)
          },
        },
        {
          label: "Launch at Login",
          type: "checkbox",
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked })
          },
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── IPC handlers (native features exposed to renderer) ──────────────────────

function registerIpcHandlers() {
  // Run AppleScript (for Calendar.app, Reminders, etc.)
  ipcMain.handle("native:applescript", async (_event, script: string) => {
    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve(stdout.trim())
      })
    })
  })

  // Get native preferences
  ipcMain.handle("native:get-preferences", () => {
    return {
      alwaysOnTop,
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
      platform: process.platform,
    }
  })

  // Set always on top
  ipcMain.handle("native:set-always-on-top", (_event, value: boolean) => {
    alwaysOnTop = value
    mainWindow?.setAlwaysOnTop(value)
    return { alwaysOnTop }
  })

  // Set launch at login
  ipcMain.handle("native:set-launch-at-login", (_event, value: boolean) => {
    app.setLoginItemSettings({ openAtLogin: value })
    return { launchAtLogin: value }
  })

  // Open URL in default browser
  ipcMain.handle("native:open-external", (_event, url: string) => {
    shell.openExternal(url)
  })

  // Show native notification
  ipcMain.handle("native:notify", (_event, data: { title: string; body: string }) => {
    const { Notification } = require("electron")
    new Notification({ title: data.title, body: data.body }).show()
  })

  // AI engine handlers (node-llama-cpp with Metal GPU)
  registerAIHandlers(ipcMain, (channel: string, data: unknown) => {
    mainWindow?.webContents.send(channel, data)
  })
}

// ── App lifecycle ───────────────────────────────────────────────────────────

app.on("before-quit", () => {
  isQuitting = true
})

app.whenReady().then(() => {
  buildMenu()
  createWindow()
  createTray()
  registerIpcHandlers()

  // Global shortcut: Cmd+Shift+D to toggle dashboard
  globalShortcut.register("CommandOrControl+Shift+D", toggleWindow)

  app.on("activate", () => {
    showWindow()
  })
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
