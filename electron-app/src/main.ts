import { app, BrowserWindow, ipcMain, screen } from "electron"
import path from "path"
import { initDatabase } from "./database"
import { registerIpcHandlers } from "./ipc-handlers"

const IS_DEV = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 800,
    minHeight: 600,
    title: "Third Screen",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#1a1a2e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (IS_DEV) {
    // Development: load from Next.js dev server
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    // Production: load static export
    mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"))
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Initialize SQLite database
  initDatabase()

  // Register all IPC handlers
  registerIpcHandlers()

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
