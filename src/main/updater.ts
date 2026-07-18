import { app } from 'electron'
import electronUpdater, {
  type AppUpdater,
  type ProgressInfo,
  type UpdateInfo
} from 'electron-updater'
import type { UpdateState } from '../shared/model'

const FIRST_CHECK_DELAY_MS = 15_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface UpdateRuntime {
  currentVersion: string
  packaged: boolean
  platform: NodeJS.Platform
}

function getAutoUpdater(): AppUpdater {
  // electron-updater is CommonJS; destructuring the default import keeps ESM builds compatible.
  return electronUpdater.autoUpdater
}

function safePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export class UpdateManager {
  readonly #updater: AppUpdater
  readonly #publish: (state: UpdateState) => void
  readonly #supported: boolean
  readonly #currentVersion: string
  #state: UpdateState
  #firstCheckTimer?: NodeJS.Timeout
  #checkInterval?: NodeJS.Timeout
  #started = false

  constructor(
    publish: (state: UpdateState) => void,
    updater = getAutoUpdater(),
    runtime: UpdateRuntime = {
      currentVersion: app.getVersion(),
      packaged: app.isPackaged,
      platform: process.platform
    }
  ) {
    this.#publish = publish
    this.#updater = updater
    this.#currentVersion = runtime.currentVersion
    this.#supported = runtime.packaged && ['darwin', 'win32'].includes(runtime.platform)
    this.#state = this.#supported
      ? { phase: 'idle', currentVersion: this.#currentVersion }
      : {
          phase: 'disabled',
          currentVersion: this.#currentVersion,
          message: runtime.packaged
            ? 'Automatic updates are not available on this platform.'
            : 'Automatic updates are enabled in packaged release builds.'
        }
  }

  get state(): UpdateState {
    return structuredClone(this.#state)
  }

  start(): void {
    if (this.#started || !this.#supported) return
    this.#started = true
    this.#updater.autoDownload = false
    this.#updater.autoInstallOnAppQuit = false
    this.#updater.allowDowngrade = false
    this.#updater.allowPrerelease = false
    this.#updater.disableWebInstaller = true
    this.#updater.on('checking-for-update', this.#onChecking)
    this.#updater.on('update-available', this.#onAvailable)
    this.#updater.on('update-not-available', this.#onNotAvailable)
    this.#updater.on('download-progress', this.#onProgress)
    this.#updater.on('update-downloaded', this.#onDownloaded)
    this.#updater.on('error', this.#onError)

    this.#firstCheckTimer = setTimeout(() => void this.check(), FIRST_CHECK_DELAY_MS)
    this.#firstCheckTimer.unref()
    this.#checkInterval = setInterval(() => void this.check(), CHECK_INTERVAL_MS)
    this.#checkInterval.unref()
  }

  async check(): Promise<UpdateState> {
    if (!this.#supported || ['checking', 'downloading', 'downloaded'].includes(this.#state.phase))
      return this.state
    try {
      await this.#updater.checkForUpdates()
    } catch (error) {
      this.#handleError(error)
    }
    return this.state
  }

  async download(): Promise<UpdateState> {
    if (!this.#supported || this.#state.phase !== 'available') return this.state
    this.#setState({
      phase: 'downloading',
      currentVersion: this.#currentVersion,
      ...(this.#state.availableVersion ? { availableVersion: this.#state.availableVersion } : {}),
      progressPercent: 0,
      ...(this.#state.checkedAt ? { checkedAt: this.#state.checkedAt } : {})
    })
    try {
      await this.#updater.downloadUpdate()
    } catch (error) {
      this.#handleError(error)
    }
    return this.state
  }

  install(): void {
    if (!this.#supported || this.#state.phase !== 'downloaded') return
    setImmediate(() => this.#updater.quitAndInstall(false, true))
  }

  dispose(): void {
    if (this.#firstCheckTimer) clearTimeout(this.#firstCheckTimer)
    if (this.#checkInterval) clearInterval(this.#checkInterval)
    if (!this.#started) return
    this.#updater.off('checking-for-update', this.#onChecking)
    this.#updater.off('update-available', this.#onAvailable)
    this.#updater.off('update-not-available', this.#onNotAvailable)
    this.#updater.off('download-progress', this.#onProgress)
    this.#updater.off('update-downloaded', this.#onDownloaded)
    this.#updater.off('error', this.#onError)
  }

  readonly #onChecking = (): void => {
    this.#setState({
      phase: 'checking',
      currentVersion: this.#currentVersion,
      ...(this.#state.availableVersion ? { availableVersion: this.#state.availableVersion } : {})
    })
  }

  readonly #onAvailable = (info: UpdateInfo): void => {
    this.#setState({
      phase: 'available',
      currentVersion: this.#currentVersion,
      availableVersion: info.version,
      checkedAt: new Date().toISOString()
    })
  }

  readonly #onNotAvailable = (): void => {
    this.#setState({
      phase: 'up-to-date',
      currentVersion: this.#currentVersion,
      checkedAt: new Date().toISOString()
    })
  }

  readonly #onProgress = (progress: ProgressInfo): void => {
    this.#setState({
      phase: 'downloading',
      currentVersion: this.#currentVersion,
      ...(this.#state.availableVersion ? { availableVersion: this.#state.availableVersion } : {}),
      progressPercent: safePercent(progress.percent)
    })
  }

  readonly #onDownloaded = (info: UpdateInfo): void => {
    this.#setState({
      phase: 'downloaded',
      currentVersion: this.#currentVersion,
      availableVersion: info.version,
      progressPercent: 100,
      checkedAt: new Date().toISOString()
    })
  }

  readonly #onError = (error: Error): void => this.#handleError(error)

  #handleError(error: unknown): void {
    console.error('Porticle update failed:', error)
    this.#setState({
      phase: 'error',
      currentVersion: this.#currentVersion,
      ...(this.#state.availableVersion ? { availableVersion: this.#state.availableVersion } : {}),
      message: 'Porticle could not reach the official GitHub release channel. Try again later.'
    })
  }

  #setState(state: UpdateState): void {
    this.#state = state
    this.#publish(this.state)
  }
}
