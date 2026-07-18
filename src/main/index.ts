import { app } from 'electron'
import { join } from 'node:path'
import { APP_ID, APP_NAME } from '../shared/defaults'
import { AppController } from './controller'
import { registerIpc, unregisterIpc } from './ipc'
import { hardenSession, installAppProtocol } from './security'

app.setName(APP_NAME)
if (process.platform === 'win32') app.setAppUserModelId(APP_ID)

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

let controller: AppController | undefined

void app
  .whenReady()
  .then(async () => {
    hardenSession()
    installAppProtocol(join(import.meta.dirname, '../renderer'))
    controller = await AppController.create()
    registerIpc(controller)
    await controller.start()

    app.on('second-instance', () => controller?.popover.show())
    app.on('activate', () => controller?.popover.show())
  })
  .catch((error: unknown) => {
    console.error('Porticle failed to start:', error)
    app.quit()
  })

app.on('before-quit', () => {
  unregisterIpc()
  controller?.dispose()
})

app.on('window-all-closed', () => {
  // Porticle is tray-first and deliberately keeps running with no open windows.
})
