import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z, type ZodType } from 'zod'
import { IPC } from '../shared/ipc'
import {
  copyRequestSchema,
  noArgumentsSchema,
  openRequestSchema,
  settingsPatchSchema,
  terminateRequestSchema,
  watchRequestSchema
} from '../shared/schemas'
import type { AppController } from './controller'
import type { AppSettings } from '../shared/model'
import { isAllowedRendererUrl } from './security'

export function registerIpc(controller: AppController): void {
  const handle = <TInput, TOutput>(
    channel: string,
    schema: ZodType<TInput>,
    handler: (input: TInput) => TOutput | Promise<TOutput>
  ): void => {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertTrustedSender(event, controller)
      const input = schema.parse(args)
      return handler(input)
    })
  }

  handle(IPC.snapshotGet, noArgumentsSchema, () => controller.snapshot)
  handle(IPC.snapshotRefresh, noArgumentsSchema, () => controller.refresh())
  handle(IPC.settingsGet, noArgumentsSchema, () => controller.settings.value)
  handle(IPC.settingsUpdate, z.tuple([settingsPatchSchema]), ([patch]) =>
    controller.updateSettings(patch as Partial<AppSettings>)
  )
  handle(IPC.processTerminate, z.tuple([terminateRequestSchema]), ([request]) => {
    const normalized = {
      id: request.id,
      endpointKey: request.endpointKey,
      processToken: request.processToken,
      pid: request.pid,
      port: request.port,
      ...(request.force === undefined ? {} : { force: request.force })
    }
    return controller.terminate(normalized)
  })
  handle(IPC.clipboardCopy, z.tuple([copyRequestSchema]), ([request]) => controller.copy(request))
  handle(IPC.serviceOpen, z.tuple([openRequestSchema]), ([request]) => controller.open(request))
  handle(IPC.watchSet, z.tuple([watchRequestSchema]), ([request]) => controller.setWatched(request))
  handle(IPC.appInfo, noArgumentsSchema, () => controller.appInfo())
  handle(IPC.updateGet, noArgumentsSchema, () => controller.updateState())
  handle(IPC.updateCheck, noArgumentsSchema, () => controller.checkForUpdates())
  handle(IPC.updateDownload, noArgumentsSchema, () => controller.downloadUpdate())
  handle(IPC.updateInstall, noArgumentsSchema, () => controller.installUpdate())
  handle(IPC.appHide, noArgumentsSchema, () => controller.hide())
  handle(IPC.appQuit, noArgumentsSchema, () => controller.quit())
}

export function unregisterIpc(): void {
  for (const channel of Object.values(IPC)) {
    if (!channel.endsWith(':changed')) ipcMain.removeHandler(channel)
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent, controller: AppController): void {
  const frameUrl = event.senderFrame?.url ?? event.sender.getURL()
  if (
    event.sender !== controller.webContents ||
    event.senderFrame !== controller.webContents.mainFrame ||
    !isAllowedRendererUrl(frameUrl)
  ) {
    throw new Error('Rejected IPC from an untrusted renderer')
  }
}
