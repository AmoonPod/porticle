import type {
  ActionResult,
  AppInfo,
  AppSettings,
  PorticleApi,
  PortRecord,
  PortSnapshot,
  TerminateRequest,
  TerminateResult,
  UpdateState,
  WatchRequest
} from '../../../shared/model'
import { DEFAULT_SETTINGS } from '../../../shared/defaults'

type Listener<T> = (value: T) => void

const themeQuery = new URLSearchParams(window.location.search).get('theme')
let settings: AppSettings = {
  ...structuredClone(DEFAULT_SETTINGS),
  theme: themeQuery === 'light' || themeQuery === 'dark' ? themeQuery : 'system',
  watchedPorts: [3000, 5432, 9229]
}

let snapshot: PortSnapshot = {
  records: [
    mockRecord({
      port: 3000,
      pid: 84127,
      processName: 'node',
      command: 'node ./node_modules/next/dist/bin/next dev --turbo',
      service: { id: 'next', name: 'Next.js', category: 'web', url: 'http://localhost:3000' }
    }),
    mockRecord({
      port: 5173,
      pid: 84204,
      processName: 'node',
      command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1',
      address: '127.0.0.1',
      service: { id: 'vite', name: 'Vite', category: 'web', url: 'http://localhost:5173' }
    }),
    mockRecord({
      port: 5432,
      pid: 912,
      processName: 'postgres',
      command: '/opt/homebrew/opt/postgresql@17/bin/postgres -D /opt/homebrew/var/postgresql@17',
      service: { id: 'postgres', name: 'PostgreSQL', category: 'database' }
    }),
    mockRecord({
      port: 6379,
      pid: 1138,
      processName: 'redis-server',
      command: '/opt/homebrew/bin/redis-server 127.0.0.1:6379',
      address: '127.0.0.1',
      service: { id: 'redis', name: 'Redis', category: 'cache' }
    }),
    mockRecord({
      port: 8080,
      pid: 84311,
      processName: 'python3.13',
      command: 'python3 -m uvicorn api.main:app --reload --port 8080',
      family: 'ipv6',
      address: '::1',
      service: { id: 'local-web', name: 'Local API', category: 'web', url: 'http://localhost:8080' }
    }),
    mockRecord({
      port: 5353,
      pid: 412,
      processName: 'mDNSResponder',
      command: '/usr/sbin/mDNSResponder',
      protocol: 'udp',
      state: 'bound',
      protected: true,
      service: { id: 'mdns', name: 'mDNS', category: 'system' }
    })
  ],
  status: {
    state: 'ready',
    revision: 7,
    updatedAt: new Date().toISOString(),
    durationMs: 46,
    warnings: []
  }
}

const snapshotListeners = new Set<Listener<PortSnapshot>>()
const settingsListeners = new Set<Listener<AppSettings>>()
const updateListeners = new Set<Listener<UpdateState>>()
const updateState: UpdateState = {
  phase: 'disabled',
  currentVersion: '0.1.0',
  message: 'Automatic updates are enabled in packaged release builds.'
}

export const mockApi: PorticleApi = {
  getSnapshot() {
    return Promise.resolve(structuredClone(snapshot))
  },
  refresh() {
    snapshot = {
      ...snapshot,
      status: {
        ...snapshot.status,
        revision: snapshot.status.revision + 1,
        updatedAt: new Date().toISOString(),
        durationMs: 41
      }
    }
    emit(snapshotListeners, snapshot)
    return Promise.resolve(structuredClone(snapshot))
  },
  onSnapshot(listener) {
    snapshotListeners.add(listener)
    return () => snapshotListeners.delete(listener)
  },
  getSettings() {
    return Promise.resolve(structuredClone(settings))
  },
  updateSettings(patch) {
    settings = { ...settings, ...patch }
    emit(settingsListeners, settings)
    return Promise.resolve(structuredClone(settings))
  },
  onSettings(listener) {
    settingsListeners.add(listener)
    return () => settingsListeners.delete(listener)
  },
  terminate(request: TerminateRequest): Promise<TerminateResult> {
    const record = snapshot.records.find((candidate) => candidate.id === request.id)
    if (!record) {
      return Promise.resolve({
        outcome: 'already-stopped',
        message: `Port ${request.port} is already free.`,
        pid: request.pid,
        port: request.port
      })
    }
    snapshot = {
      records: snapshot.records.filter((candidate) => candidate.id !== request.id),
      status: {
        ...snapshot.status,
        revision: snapshot.status.revision + 1,
        updatedAt: new Date().toISOString()
      }
    }
    emit(snapshotListeners, snapshot)
    return Promise.resolve({
      outcome: 'terminated',
      message: `Stopped ${record.processName} and freed port ${record.port}.`,
      pid: record.pid,
      port: record.port
    })
  },
  copy(): Promise<ActionResult> {
    return Promise.resolve({ ok: true })
  },
  open(): Promise<ActionResult> {
    return Promise.resolve({ ok: true })
  },
  setWatched(request: WatchRequest): Promise<AppSettings> {
    const watched = new Set(settings.watchedPorts)
    if (request.watched) watched.add(request.port)
    else watched.delete(request.port)
    settings = { ...settings, watchedPorts: [...watched].sort((a, b) => a - b) }
    emit(settingsListeners, settings)
    return Promise.resolve(structuredClone(settings))
  },
  getAppInfo(): Promise<AppInfo> {
    return Promise.resolve({
      version: '0.1.0',
      platform: 'darwin',
      packaged: false,
      shortcutRegistered: true
    })
  },
  getUpdateState: () => Promise.resolve(structuredClone(updateState)),
  checkForUpdates: () => Promise.resolve(structuredClone(updateState)),
  downloadUpdate: () => Promise.resolve(structuredClone(updateState)),
  installUpdate: () => Promise.resolve(),
  onUpdateState(listener) {
    updateListeners.add(listener)
    return () => updateListeners.delete(listener)
  },
  hide: () => Promise.resolve(),
  quit: () => Promise.resolve()
}

function mockRecord(input: {
  port: number
  pid: number
  processName: string
  command: string
  protocol?: 'tcp' | 'udp'
  family?: 'ipv4' | 'ipv6'
  address?: string
  state?: 'listen' | 'bound'
  protected?: boolean
  service?: PortRecord['service']
}): PortRecord {
  const protocol = input.protocol ?? 'tcp'
  const family = input.family ?? 'ipv4'
  const address = input.address ?? '*'
  const endpointKey = `${protocol}:${family}:${address}:${input.port}`
  return {
    id: `${endpointKey}:${input.pid}`,
    endpointKey,
    processToken: `${input.pid}:mock-start`,
    port: input.port,
    protocol,
    family,
    address,
    scope:
      address === '*' ? 'any' : address === '127.0.0.1' || address === '::1' ? 'loopback' : 'lan',
    state: input.state ?? (protocol === 'tcp' ? 'listen' : 'bound'),
    pid: input.pid,
    parentPid: 777,
    processName: input.processName,
    command: input.command,
    ...(input.command.split(' ')[0] ? { executable: input.command.split(' ')[0] } : {}),
    owner: '501',
    startedAt: 'Fri Jul 17 18:00:00 2026',
    ...(input.service ? { service: input.service } : {}),
    protected: input.protected ?? false
  }
}

function emit<T>(listeners: ReadonlySet<Listener<T>>, value: T): void {
  for (const listener of listeners) listener(structuredClone(value))
}
