import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  CopyRequest,
  OpenRequest,
  PorticleApi,
  PortSnapshot,
  TerminateRequest,
  UpdateState,
  WatchRequest
} from '../shared/model'
import { IPC } from '../shared/ipc'

const subscribe = <T>(channel: string, listener: (value: T) => void): (() => void) => {
  const wrapped = (_event: Electron.IpcRendererEvent, value: T): void => listener(value)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: PorticleApi = Object.freeze({
  getSnapshot: () => ipcRenderer.invoke(IPC.snapshotGet) as Promise<PortSnapshot>,
  refresh: () => ipcRenderer.invoke(IPC.snapshotRefresh) as Promise<PortSnapshot>,
  onSnapshot: (listener: (snapshot: PortSnapshot) => void) =>
    subscribe(IPC.snapshotChanged, listener),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<AppSettings>,
  updateSettings: (patch: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC.settingsUpdate, patch) as Promise<AppSettings>,
  onSettings: (listener: (settings: AppSettings) => void) =>
    subscribe(IPC.settingsChanged, listener),
  terminate: (request: TerminateRequest) => ipcRenderer.invoke(IPC.processTerminate, request),
  copy: (request: CopyRequest) => ipcRenderer.invoke(IPC.clipboardCopy, request),
  open: (request: OpenRequest) => ipcRenderer.invoke(IPC.serviceOpen, request),
  setWatched: (request: WatchRequest) => ipcRenderer.invoke(IPC.watchSet, request),
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  getUpdateState: () => ipcRenderer.invoke(IPC.updateGet) as Promise<UpdateState>,
  checkForUpdates: () => ipcRenderer.invoke(IPC.updateCheck) as Promise<UpdateState>,
  downloadUpdate: () => ipcRenderer.invoke(IPC.updateDownload) as Promise<UpdateState>,
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall) as Promise<void>,
  onUpdateState: (listener: (state: UpdateState) => void) => subscribe(IPC.updateChanged, listener),
  hide: () => ipcRenderer.invoke(IPC.appHide),
  quit: () => ipcRenderer.invoke(IPC.appQuit)
})

contextBridge.exposeInMainWorld('porticle', api)
