export type Protocol = 'tcp' | 'udp'
export type AddressFamily = 'ipv4' | 'ipv6'
export type AddressScope = 'loopback' | 'any' | 'lan' | 'unknown'
export type EndpointState = 'listen' | 'bound'

export interface RecognizedService {
  id: string
  name: string
  category: 'web' | 'database' | 'cache' | 'queue' | 'container' | 'system' | 'other'
  url?: string
}

export interface PortRecord {
  id: string
  endpointKey: string
  processToken: string
  port: number
  protocol: Protocol
  family: AddressFamily
  address: string
  scope: AddressScope
  state: EndpointState
  pid: number
  parentPid?: number
  processName: string
  command?: string
  executable?: string
  owner?: string
  startedAt?: string
  service?: RecognizedService
  protected: boolean
}

export interface ScanStatus {
  state: 'idle' | 'scanning' | 'ready' | 'error' | 'unsupported'
  revision: number
  updatedAt?: string
  durationMs?: number
  warnings: string[]
  error?: string
}

export interface PortSnapshot {
  records: PortRecord[]
  status: ScanStatus
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type RefreshInterval = 1000 | 2000 | 5000 | 10000
export type ForceKillDelay = 0 | 1500 | 3000

export interface AppSettings {
  theme: ThemeMode
  accent: string
  refreshInterval: RefreshInterval
  confirmBeforeKill: boolean
  forceKillAfterMs: ForceKillDelay
  launchAtLogin: boolean
  shortcutEnabled: boolean
  globalShortcut: string
  watchedPorts: number[]
  notifications: boolean
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  packaged: boolean
  shortcutRegistered: boolean
}

export type UpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateState {
  phase: UpdatePhase
  currentVersion: string
  availableVersion?: string
  progressPercent?: number
  checkedAt?: string
  message?: string
}

export type CopyField = 'port' | 'pid' | 'command' | 'address' | 'url'

export interface TerminateRequest {
  id: string
  endpointKey: string
  processToken: string
  pid: number
  port: number
  force?: boolean
}

export type TerminationOutcome =
  | 'terminated'
  | 'force-terminated'
  | 'already-stopped'
  | 'stale'
  | 'reopened'
  | 'permission-denied'
  | 'protected'
  | 'failed'

export interface TerminateResult {
  outcome: TerminationOutcome
  message: string
  pid: number
  port: number
  replacement?: Pick<PortRecord, 'pid' | 'processName' | 'processToken'>
}

export interface CopyRequest {
  id: string
  field: CopyField
}

export interface OpenRequest {
  id: string
}

export interface WatchRequest {
  port: number
  watched: boolean
}

export interface ActionResult {
  ok: boolean
  message?: string
}

export interface PorticleApi {
  getSnapshot(): Promise<PortSnapshot>
  refresh(): Promise<PortSnapshot>
  onSnapshot(listener: (snapshot: PortSnapshot) => void): () => void
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  onSettings(listener: (settings: AppSettings) => void): () => void
  terminate(request: TerminateRequest): Promise<TerminateResult>
  copy(request: CopyRequest): Promise<ActionResult>
  open(request: OpenRequest): Promise<ActionResult>
  setWatched(request: WatchRequest): Promise<AppSettings>
  getAppInfo(): Promise<AppInfo>
  getUpdateState(): Promise<UpdateState>
  checkForUpdates(): Promise<UpdateState>
  downloadUpdate(): Promise<UpdateState>
  installUpdate(): Promise<void>
  onUpdateState(listener: (state: UpdateState) => void): () => void
  hide(): Promise<void>
  quit(): Promise<void>
}
