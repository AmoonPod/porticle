import type {
  AddressFamily,
  AddressScope,
  EndpointState,
  PortRecord,
  Protocol
} from '../../shared/model'
import { recognizeService } from './services'
import type { ProcessInfo, RawEndpoint } from './types'

export function addressScope(address: string): AddressScope {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === '*' || normalized === '0.0.0.0' || normalized === '::') return 'any'
  if (normalized === '::1' || normalized.startsWith('127.')) return 'loopback'
  if (
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return 'lan'
  }
  return 'unknown'
}

export function endpointKey(
  protocol: Protocol,
  family: AddressFamily,
  address: string,
  port: number
): string {
  return `${protocol}:${family}:${address.toLowerCase()}:${port}`
}

export function processToken(processInfo: ProcessInfo | undefined, pid: number): string {
  const identity = processInfo?.startedAt ?? processInfo?.command ?? processInfo?.name ?? 'unknown'
  return `${pid}:${identity}`
}

export function normalizeEndpoints(
  endpoints: readonly RawEndpoint[],
  processes: ReadonlyMap<number, ProcessInfo>,
  protectedPids: ReadonlySet<number>,
  currentUid?: number
): PortRecord[] {
  const seen = new Set<string>()
  const records: PortRecord[] = []

  for (const endpoint of endpoints) {
    const processInfo = processes.get(endpoint.pid)
    const key = endpointKey(endpoint.protocol, endpoint.family, endpoint.address, endpoint.port)
    const dedupeKey = `${key}:${endpoint.pid}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const token = processToken(processInfo, endpoint.pid)
    const processName = endpoint.processName ?? processInfo?.name ?? `PID ${endpoint.pid}`
    const isRootOwned = currentUid !== undefined && currentUid !== 0 && processInfo?.owner === '0'
    const service = recognizeService({
      port: endpoint.port,
      protocol: endpoint.protocol,
      processName,
      ...(processInfo?.command ? { command: processInfo.command } : {})
    })

    records.push({
      id: `${key}:${endpoint.pid}`,
      endpointKey: key,
      processToken: token,
      port: endpoint.port,
      protocol: endpoint.protocol,
      family: endpoint.family,
      address: endpoint.address,
      scope: addressScope(endpoint.address),
      state: endpoint.state,
      pid: endpoint.pid,
      ...(processInfo?.parentPid !== undefined ? { parentPid: processInfo.parentPid } : {}),
      processName,
      ...(processInfo?.command ? { command: processInfo.command } : {}),
      ...(processInfo?.executable ? { executable: processInfo.executable } : {}),
      ...(processInfo?.owner ? { owner: processInfo.owner } : {}),
      ...(processInfo?.startedAt ? { startedAt: processInfo.startedAt } : {}),
      ...(service ? { service } : {}),
      protected: endpoint.pid <= 1 || protectedPids.has(endpoint.pid) || isRootOwned
    })
  }

  return records.sort(comparePortRecords)
}

function comparePortRecords(left: PortRecord, right: PortRecord): number {
  return (
    left.port - right.port ||
    left.protocol.localeCompare(right.protocol) ||
    left.family.localeCompare(right.family) ||
    left.address.localeCompare(right.address) ||
    left.pid - right.pid
  )
}

export function makeRawEndpoint(input: {
  pid: number
  port: number
  protocol: Protocol
  family: AddressFamily
  address: string
  processName?: string
  state?: EndpointState
}): RawEndpoint {
  return {
    pid: input.pid,
    port: input.port,
    protocol: input.protocol,
    family: input.family,
    address: input.address,
    ...(input.processName ? { processName: input.processName } : {}),
    state: input.state ?? (input.protocol === 'tcp' ? 'listen' : 'bound')
  }
}
