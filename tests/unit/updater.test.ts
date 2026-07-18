import { EventEmitter } from 'node:events'
import { setImmediate as waitForImmediate } from 'node:timers/promises'
import type { AppUpdater } from 'electron-updater'
import { describe, expect, it, vi } from 'vitest'
import { UpdateManager, type UpdateRuntime } from '../../src/main/updater'

class FakeUpdater extends EventEmitter {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowDowngrade = true
  allowPrerelease = true
  disableWebInstaller = false
  checkForUpdates = vi.fn(() => Promise.resolve(null))
  downloadUpdate = vi.fn(() => Promise.resolve([]))
  quitAndInstall = vi.fn()
}

const runtime: UpdateRuntime = {
  currentVersion: '0.1.0',
  packaged: true,
  platform: 'darwin'
}

function createManager() {
  const updater = new FakeUpdater()
  const publish = vi.fn()
  const manager = new UpdateManager(publish, updater as unknown as AppUpdater, runtime)
  manager.start()
  return { manager, publish, updater }
}

describe('UpdateManager', () => {
  it('enforces the stable manual-update policy', () => {
    const { manager, updater } = createManager()

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.allowPrerelease).toBe(false)
    expect(updater.disableWebInstaller).toBe(true)

    manager.dispose()
  })

  it('publishes available, progress, downloaded, and install states', async () => {
    const { manager, publish, updater } = createManager()

    updater.emit('update-available', { version: '0.2.0' })
    expect(manager.state).toMatchObject({
      phase: 'available',
      currentVersion: '0.1.0',
      availableVersion: '0.2.0'
    })

    await manager.download()
    expect(updater.downloadUpdate).toHaveBeenCalledOnce()
    expect(manager.state).toMatchObject({ phase: 'downloading', progressPercent: 0 })

    updater.emit('download-progress', { percent: 48.6 })
    expect(manager.state).toMatchObject({ phase: 'downloading', progressPercent: 49 })

    updater.emit('update-downloaded', { version: '0.2.0' })
    expect(manager.state).toMatchObject({ phase: 'downloaded', progressPercent: 100 })

    manager.install()
    await waitForImmediate()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
    expect(publish).toHaveBeenCalled()

    manager.dispose()
  })

  it('reports updater errors without exposing the original message to the renderer', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { manager, updater } = createManager()

    updater.emit('error', new Error('request included sensitive diagnostics'))

    expect(manager.state).toMatchObject({
      phase: 'error',
      currentVersion: '0.1.0',
      message: 'Porticle could not reach the official GitHub release channel. Try again later.'
    })
    expect(consoleError).toHaveBeenCalledOnce()

    manager.dispose()
    consoleError.mockRestore()
  })

  it('stays disabled outside packaged desktop releases', async () => {
    const updater = new FakeUpdater()
    const manager = new UpdateManager(vi.fn(), updater as unknown as AppUpdater, {
      ...runtime,
      packaged: false
    })

    manager.start()
    await manager.check()

    expect(manager.state.phase).toBe('disabled')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.listenerCount('update-available')).toBe(0)
  })
})
