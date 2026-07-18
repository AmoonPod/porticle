import type { AddressFamily, PortRecord, Protocol } from '../../shared/model'

export interface ProcessInfo {
  pid: number
  parentPid?: number
  owner?: string
  name: string
  command?: string
  executable?: string
  startedAt?: string
}

export interface RawEndpoint {
  pid: number
  port: number
  protocol: Protocol
  family: AddressFamily
  address: string
  processName?: string
  state: 'listen' | 'bound'
}

export interface DiscoveryResult {
  records: PortRecord[]
  processes: Map<number, ProcessInfo>
  warnings: string[]
}

export interface PortDiscovery {
  scan(): Promise<DiscoveryResult>
  processCatalog(): Promise<Map<number, ProcessInfo>>
}
