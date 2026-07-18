import { Menu, Tray, app, nativeImage } from 'electron'
import type { PortSnapshot } from '../shared/model'
import { resourcePath } from './resources'
import type { PopoverWindow } from './window'

interface TrayActions {
  refresh: () => void
  quit: () => void
}

export class AppTray {
  readonly tray: Tray
  readonly #popover: PopoverWindow
  readonly #actions: TrayActions

  constructor(popover: PopoverWindow, actions: TrayActions) {
    this.#popover = popover
    this.#actions = actions
    const iconFile = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray-windows.png'
    const icon = nativeImage.createFromPath(resourcePath(iconFile))
    if (process.platform === 'darwin') icon.setTemplateImage(true)
    this.tray = new Tray(icon)
    this.tray.setToolTip('Porticle')
    this.#syncBounds()

    this.tray.on('click', () => {
      this.#syncBounds()
      this.#popover.toggle()
    })
    this.tray.on('right-click', () => this.#showContextMenu())
    this.tray.on('double-click', () => {
      if (process.platform === 'win32') {
        this.#syncBounds()
        this.#popover.show()
      }
    })
  }

  update(snapshot: PortSnapshot): void {
    const count = snapshot.records.length
    this.tray.setToolTip(`Porticle · ${count} active ${count === 1 ? 'port' : 'ports'}`)
  }

  destroy(): void {
    this.tray.destroy()
  }

  #syncBounds(): void {
    this.#popover.setTrayBounds(this.tray.getBounds())
  }

  #showContextMenu(): void {
    const menu = Menu.buildFromTemplate([
      {
        label: this.#popover.window.isVisible() ? 'Hide Porticle' : 'Show Porticle',
        click: () => this.#popover.toggle()
      },
      { label: 'Refresh ports', click: this.#actions.refresh },
      { type: 'separator' },
      { label: `Quit ${app.name}`, click: this.#actions.quit }
    ])
    this.tray.popUpContextMenu(menu)
  }
}
