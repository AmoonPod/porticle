import { BrowserWindow, app, screen, type Rectangle } from 'electron'
import { join } from 'node:path'
import { APP_ORIGIN, isAllowedRendererUrl } from './security'
import { resourcePath } from './resources'

const WINDOW_WIDTH = 420
const WINDOW_HEIGHT = 640
const EDGE_GAP = 8

export class PopoverWindow {
  readonly window: BrowserWindow
  #trayBounds?: Rectangle

  constructor() {
    let quitting = false
    app.once('before-quit', () => {
      quitting = true
    })
    const options: Electron.BrowserWindowConstructorOptions = {
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      minWidth: WINDOW_WIDTH,
      minHeight: 520,
      maxWidth: WINDOW_WIDTH,
      maxHeight: 760,
      show: false,
      frame: false,
      transparent: false,
      resizable: true,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      icon: resourcePath('icon.png'),
      backgroundColor: '#17191e',
      title: 'Porticle',
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        webviewTag: false,
        spellcheck: false,
        devTools: !app.isPackaged
      }
    }
    if (process.platform === 'darwin') options.type = 'panel'
    this.window = new BrowserWindow(options)
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.window.setAlwaysOnTop(true, process.platform === 'darwin' ? 'pop-up-menu' : 'floating')

    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.window.webContents.on('will-navigate', (event, url) => {
      if (!isAllowedRendererUrl(url)) event.preventDefault()
    })
    this.window.webContents.on('will-attach-webview', (event) => event.preventDefault())
    this.window.on('blur', () => {
      if (!this.window.webContents.isDevToolsOpened()) this.hide()
    })
    this.window.on('close', (event) => {
      if (!quitting) {
        event.preventDefault()
        this.hide()
      }
    })
  }

  async load(): Promise<void> {
    const developmentUrl = process.env.ELECTRON_RENDERER_URL
    if (!app.isPackaged && developmentUrl) {
      await this.window.loadURL(developmentUrl)
      return
    }
    await this.window.loadURL(`${APP_ORIGIN}/index.html`)
  }

  setTrayBounds(bounds: Rectangle): void {
    this.#trayBounds = bounds
  }

  toggle(): void {
    if (this.window.isVisible()) this.hide()
    else this.show()
  }

  show(): void {
    if (this.window.isDestroyed()) return
    this.#position()
    this.window.show()
    this.window.focus()
  }

  hide(): void {
    if (!this.window.isDestroyed()) this.window.hide()
  }

  #position(): void {
    const tray = this.#trayBounds
    if (!tray) return
    const display = screen.getDisplayNearestPoint({ x: tray.x, y: tray.y })
    const workArea = display.workArea
    const bounds = this.window.getBounds()

    let x = Math.round(tray.x + tray.width / 2 - bounds.width / 2)
    const trayIsAtBottom = tray.y > workArea.y + workArea.height / 2
    let y = trayIsAtBottom ? tray.y - bounds.height - EDGE_GAP : tray.y + tray.height + EDGE_GAP

    x = Math.max(
      workArea.x + EDGE_GAP,
      Math.min(x, workArea.x + workArea.width - bounds.width - EDGE_GAP)
    )
    y = Math.max(
      workArea.y + EDGE_GAP,
      Math.min(y, workArea.y + workArea.height - bounds.height - EDGE_GAP)
    )
    this.window.setPosition(x, y, false)
  }
}
