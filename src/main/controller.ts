import {
  Notification,
  app,
  clipboard,
  globalShortcut,
  nativeTheme,
  shell,
  type WebContents
} from 'electron'
import type {
  ActionResult,
  AppInfo,
  AppSettings,
  CopyRequest,
  OpenRequest,
  PortRecord,
  PortSnapshot,
  TerminateRequest,
  TerminateResult,
  UpdateState,
  WatchRequest
} from '../shared/model'
import { IPC } from '../shared/ipc'
import { createPortDiscovery } from './ports'
import { PortMonitor } from './ports/monitor'
import { ProcessTerminator } from './process/terminator'
import { SettingsStore } from './settings/store'
import { AppTray } from './tray'
import { UpdateManager } from './updater'
import { PopoverWindow } from './window'

export class AppController {
  readonly settings: SettingsStore
  readonly monitor: PortMonitor
  readonly popover: PopoverWindow
  readonly tray: AppTray
  readonly terminator: ProcessTerminator
  readonly updates: UpdateManager
  #shortcutRegistered = false
  #watchedBaseline?: Map<number, PortRecord>

  private constructor(
    settings: SettingsStore,
    monitor: PortMonitor,
    popover: PopoverWindow,
    tray: AppTray,
    terminator: ProcessTerminator,
    updates: UpdateManager
  ) {
    this.settings = settings
    this.monitor = monitor
    this.popover = popover
    this.tray = tray
    this.terminator = terminator
    this.updates = updates
  }

  static async create(): Promise<AppController> {
    const settings = new SettingsStore(app.getPath('userData'))
    await settings.load()
    const protectedPids = (): ReadonlySet<number> =>
      new Set([process.pid, ...app.getAppMetrics().map((metric) => metric.pid)])
    const discovery = createPortDiscovery(protectedPids)
    const monitor = new PortMonitor(discovery)
    const popover = new PopoverWindow()
    const tray = new AppTray(popover, {
      refresh: () => void monitor.refresh(),
      quit: () => app.quit()
    })
    const terminator = new ProcessTerminator(discovery, () => settings.value, protectedPids)
    const updates = new UpdateManager((state) => {
      if (!popover.window.webContents.isDestroyed()) {
        popover.window.webContents.send(IPC.updateChanged, state)
      }
    })
    const controller = new AppController(settings, monitor, popover, tray, terminator, updates)
    controller.#bind()
    controller.#applySettings(settings.value)
    return controller
  }

  async start(): Promise<void> {
    await this.popover.load()
    this.monitor.start(this.#monitorInterval())
    this.updates.start()
  }

  get webContents(): WebContents {
    return this.popover.window.webContents
  }

  get snapshot(): PortSnapshot {
    return this.monitor.snapshot
  }

  async refresh(): Promise<PortSnapshot> {
    return this.monitor.refresh()
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return this.settings.update(patch)
  }

  async terminate(request: TerminateRequest): Promise<TerminateResult> {
    const result = await this.terminator.terminate(request)
    await this.monitor.refresh()
    if (result.outcome === 'reopened' || result.outcome === 'permission-denied') {
      this.#notify(
        result.outcome === 'reopened' ? 'Port reopened' : 'Permission denied',
        result.message
      )
    }
    return result
  }

  copy(request: CopyRequest): ActionResult {
    const record = this.monitor.find(request.id)
    if (!record) return { ok: false, message: 'That port changed before it could be copied.' }
    const values: Record<CopyRequest['field'], string | undefined> = {
      port: String(record.port),
      pid: String(record.pid),
      command: record.command,
      address: formatEndpoint(record),
      url: record.service?.url
    }
    const value = values[request.field]
    if (!value) return { ok: false, message: `No ${request.field} is available for this port.` }
    clipboard.writeText(value)
    return { ok: true }
  }

  async open(request: OpenRequest): Promise<ActionResult> {
    const record = this.monitor.find(request.id)
    const rawUrl = record?.service?.url
    if (!record || !rawUrl)
      return { ok: false, message: 'This endpoint is not a recognized web service.' }
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'localhost') {
      return { ok: false, message: 'Porticle only opens validated localhost URLs.' }
    }
    await shell.openExternal(url.toString(), { activate: true })
    return { ok: true }
  }

  async setWatched(request: WatchRequest): Promise<AppSettings> {
    const watched = new Set(this.settings.value.watchedPorts)
    if (request.watched) watched.add(request.port)
    else watched.delete(request.port)
    return this.settings.update({ watchedPorts: [...watched] })
  }

  appInfo(): AppInfo {
    return {
      version: app.getVersion(),
      platform: process.platform,
      packaged: app.isPackaged,
      shortcutRegistered: this.#shortcutRegistered
    }
  }

  updateState(): UpdateState {
    return this.updates.state
  }

  checkForUpdates(): Promise<UpdateState> {
    return this.updates.check()
  }

  downloadUpdate(): Promise<UpdateState> {
    return this.updates.download()
  }

  installUpdate(): void {
    this.updates.install()
  }

  hide(): void {
    this.popover.hide()
  }

  quit(): void {
    app.quit()
  }

  dispose(): void {
    this.monitor.stop()
    this.updates.dispose()
    globalShortcut.unregisterAll()
    this.tray.destroy()
  }

  #bind(): void {
    this.monitor.on('changed', (snapshot) => {
      this.tray.update(snapshot)
      if (!this.webContents.isDestroyed())
        this.webContents.send('porticle:snapshot:changed', snapshot)
      this.#watchNotifications(snapshot)
    })
    this.settings.on('changed', (settings) => {
      this.#applySettings(settings)
      if (!this.webContents.isDestroyed())
        this.webContents.send('porticle:settings:changed', settings)
    })
    this.popover.window.on('show', () => {
      this.#updateMonitorInterval()
      void this.monitor.refresh()
    })
    this.popover.window.on('hide', () => this.#updateMonitorInterval())
  }

  #applySettings(settings: AppSettings): void {
    nativeTheme.themeSource = settings.theme
    this.#updateMonitorInterval()
    if (app.isPackaged && app.getLoginItemSettings().openAtLogin !== settings.launchAtLogin) {
      app.setLoginItemSettings({
        openAtLogin: settings.launchAtLogin,
        ...(process.platform === 'darwin' ? { openAsHidden: true } : {})
      })
    }
    globalShortcut.unregisterAll()
    this.#shortcutRegistered = false
    if (settings.shortcutEnabled) {
      try {
        this.#shortcutRegistered = globalShortcut.register(settings.globalShortcut, () => {
          this.popover.toggle()
        })
      } catch {
        this.#shortcutRegistered = false
      }
    }
  }

  #monitorInterval(): number {
    const settings = this.settings.value
    const needsBackgroundWatch = settings.notifications && settings.watchedPorts.length > 0
    return this.popover.window.isVisible() || needsBackgroundWatch
      ? settings.refreshInterval
      : 10_000
  }

  #updateMonitorInterval(): void {
    this.monitor.setInterval(this.#monitorInterval())
  }

  #watchNotifications(snapshot: PortSnapshot): void {
    if (snapshot.status.state !== 'ready') return
    const watchedPorts = new Set(this.settings.value.watchedPorts)
    const current = new Map<number, PortRecord>()
    for (const record of snapshot.records) {
      if (watchedPorts.has(record.port) && !current.has(record.port))
        current.set(record.port, record)
    }
    if (!this.#watchedBaseline) {
      this.#watchedBaseline = current
      return
    }

    if (this.settings.value.notifications) {
      for (const port of watchedPorts) {
        const before = this.#watchedBaseline.get(port)
        const after = current.get(port)
        if (!before && after) {
          this.#notify(`Port ${port} is active`, `${after.processName} · PID ${after.pid}`)
        } else if (before && !after) {
          this.#notify(`Port ${port} is free`, `${before.processName} stopped listening.`)
        } else if (before && after && before.processToken !== after.processToken) {
          this.#notify(`Port ${port} changed owners`, `${after.processName} · PID ${after.pid}`)
        }
      }
    }
    this.#watchedBaseline = current
  }

  #notify(title: string, body: string): void {
    if (!this.settings.value.notifications || !Notification.isSupported()) return
    new Notification({ title, body, silent: false }).show()
  }
}

function formatEndpoint(record: PortRecord): string {
  const address =
    record.family === 'ipv6' && record.address !== '*' ? `[${record.address}]` : record.address
  return `${address}:${record.port}`
}
