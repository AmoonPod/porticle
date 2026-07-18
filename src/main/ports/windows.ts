import { join, win32 } from 'node:path'
import { runCommand } from '../system/command'
import { normalizeEndpoints } from './normalize'
import type { DiscoveryResult, PortDiscovery, ProcessInfo, RawEndpoint } from './types'
import type { AddressFamily } from '../../shared/model'

const POWERSHELL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$endpoints = @()
try {
  $endpoints += Get-NetTCPConnection -State Listen -ErrorAction Stop | ForEach-Object {
    [PSCustomObject]@{ Address = $_.LocalAddress; Port = [int]$_.LocalPort; Pid = [int]$_.OwningProcess; Protocol = 'tcp' }
  }
  $endpoints += Get-NetUDPEndpoint -ErrorAction Stop | ForEach-Object {
    [PSCustomObject]@{ Address = $_.LocalAddress; Port = [int]$_.LocalPort; Pid = [int]$_.OwningProcess; Protocol = 'udp' }
  }
} catch {
  throw "The Windows NetTCPIP provider failed: $($_.Exception.Message)"
}
$processes = Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object {
  [PSCustomObject]@{
    Pid = [int]$_.ProcessId
    ParentPid = [int]$_.ParentProcessId
    Name = [string]$_.Name
    Command = [string]$_.CommandLine
    Executable = [string]$_.ExecutablePath
    StartedAt = if ($_.CreationDate) { [string]$_.CreationDate } else { '' }
  }
}
[PSCustomObject]@{ Endpoints = @($endpoints); Processes = @($processes) } | ConvertTo-Json -Compress -Depth 5
`

const WINDOWS_PROTECTED_PROCESS_NAMES = new Set([
  'system',
  'registry',
  'secure system',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'services.exe',
  'lsass.exe',
  'winlogon.exe',
  'svchost.exe'
])

interface WindowsPayload {
  Endpoints?: Array<{
    Address?: string
    Port?: number
    Pid?: number
    Protocol?: string
  }>
  Processes?: Array<{
    Pid?: number
    ParentPid?: number
    Name?: string
    Command?: string
    Executable?: string
    StartedAt?: string
  }>
}

export class WindowsPortDiscovery implements PortDiscovery {
  readonly #protectedPids: () => ReadonlySet<number>

  constructor(protectedPids: () => ReadonlySet<number>) {
    this.#protectedPids = protectedPids
  }

  async scan(): Promise<DiscoveryResult> {
    const payload = await queryWindowsNetworkState()
    const processes = parseWindowsProcesses(payload)
    const endpoints = parseWindowsEndpoints(payload)
    const protectedPids = new Set(this.#protectedPids())
    for (const processInfo of processes.values()) {
      if (isProtectedWindowsProcess(processInfo)) protectedPids.add(processInfo.pid)
    }
    return {
      records: normalizeEndpoints(endpoints, processes, protectedPids),
      processes,
      warnings: []
    }
  }

  async processCatalog(): Promise<Map<number, ProcessInfo>> {
    return parseWindowsProcesses(await queryWindowsNetworkState())
  }
}

export function isProtectedWindowsProcess(processInfo: ProcessInfo): boolean {
  return processInfo.pid <= 4 || WINDOWS_PROTECTED_PROCESS_NAMES.has(processInfo.name.toLowerCase())
}

function powershellPath(): string {
  const windowsRoot = process.env.SystemRoot ?? 'C:\\Windows'
  return join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

function encodedPowerShell(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

async function queryWindowsNetworkState(): Promise<WindowsPayload> {
  const result = await runCommand(
    powershellPath(),
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encodedPowerShell(POWERSHELL_SCRIPT)
    ],
    { timeoutMs: 8_000, maxOutputBytes: 16 * 1024 * 1024 }
  )
  if (result.exitCode !== 0) {
    throw new Error(
      `Windows port discovery failed: ${result.stderr.trim() || `exit ${String(result.exitCode)}`}`
    )
  }
  const parsed: unknown = JSON.parse(result.stdout)
  if (!parsed || typeof parsed !== 'object')
    throw new Error('Windows discovery returned invalid data')
  return parsed
}

export function parseWindowsEndpoints(payload: WindowsPayload): RawEndpoint[] {
  const endpoints: RawEndpoint[] = []
  for (const item of payload.Endpoints ?? []) {
    const address = item.Address?.trim()
    const port = item.Port
    const pid = item.Pid
    const protocol = item.Protocol?.toLowerCase()
    if (
      !address ||
      !Number.isInteger(port) ||
      port === undefined ||
      port < 1 ||
      port > 65535 ||
      !Number.isInteger(pid) ||
      pid === undefined ||
      pid < 0 ||
      (protocol !== 'tcp' && protocol !== 'udp')
    ) {
      continue
    }
    endpoints.push({
      pid,
      port,
      protocol,
      family: windowsAddressFamily(address),
      address: normalizeWindowsAddress(address),
      state: protocol === 'tcp' ? 'listen' : 'bound'
    })
  }
  return endpoints
}

export function parseWindowsProcesses(payload: WindowsPayload): Map<number, ProcessInfo> {
  const processes = new Map<number, ProcessInfo>()
  for (const item of payload.Processes ?? []) {
    if (!Number.isInteger(item.Pid) || item.Pid === undefined || item.Pid < 0) continue
    const executable = item.Executable?.trim() || undefined
    const name = item.Name?.trim() || (executable ? win32.basename(executable) : `PID ${item.Pid}`)
    processes.set(item.Pid, {
      pid: item.Pid,
      ...(Number.isInteger(item.ParentPid) ? { parentPid: item.ParentPid } : {}),
      name,
      ...(item.Command?.trim() ? { command: item.Command.trim() } : {}),
      ...(executable ? { executable } : {}),
      ...(item.StartedAt?.trim() ? { startedAt: item.StartedAt.trim() } : {})
    })
  }
  return processes
}

function normalizeWindowsAddress(address: string): string {
  if (address === '0.0.0.0' || address === '::' || address === '::0') return '*'
  return address.replace(/%\d+$/, '')
}

function windowsAddressFamily(address: string): AddressFamily {
  return address.includes(':') ? 'ipv6' : 'ipv4'
}
