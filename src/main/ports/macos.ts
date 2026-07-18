import { basename } from 'node:path'
import { runCommand } from '../system/command'
import { makeRawEndpoint, normalizeEndpoints } from './normalize'
import type { DiscoveryResult, PortDiscovery, ProcessInfo, RawEndpoint } from './types'
import type { AddressFamily, Protocol } from '../../shared/model'

const LSOF = '/usr/sbin/lsof'
const PS = '/bin/ps'
const STABLE_ENV = { ...process.env, LC_ALL: 'C', LANG: 'C' }

interface LsofParseOptions {
  protocol: Protocol
  family: AddressFamily
}

export class MacOsPortDiscovery implements PortDiscovery {
  readonly #protectedPids: () => ReadonlySet<number>

  constructor(protectedPids: () => ReadonlySet<number>) {
    this.#protectedPids = protectedPids
  }

  async scan(): Promise<DiscoveryResult> {
    const [tcp4, tcp6, udp4, udp6, processes] = await Promise.all([
      this.#lsof('tcp', 'ipv4'),
      this.#lsof('tcp', 'ipv6'),
      this.#lsof('udp', 'ipv4'),
      this.#lsof('udp', 'ipv6'),
      this.processCatalog()
    ])
    const endpoints = [...tcp4, ...tcp6, ...udp4, ...udp6]
    const currentUid = typeof process.getuid === 'function' ? process.getuid() : undefined
    return {
      records: normalizeEndpoints(endpoints, processes, this.#protectedPids(), currentUid),
      processes,
      warnings: []
    }
  }

  async processCatalog(): Promise<Map<number, ProcessInfo>> {
    const result = await runCommand(PS, ['-ww', '-axo', 'pid=,ppid=,uid=,lstart=,args='], {
      timeoutMs: 4_000,
      env: STABLE_ENV
    })
    if (result.exitCode !== 0) {
      throw new Error(`ps failed: ${result.stderr.trim() || `exit ${String(result.exitCode)}`}`)
    }
    return parsePsOutput(result.stdout)
  }

  async #lsof(protocol: Protocol, family: AddressFamily): Promise<RawEndpoint[]> {
    const selector = `-i${family === 'ipv4' ? '4' : '6'}${protocol.toUpperCase()}`
    const args = ['-nP', '-a', selector]
    if (protocol === 'tcp') args.push('-sTCP:LISTEN')
    args.push('-FpcPnT')
    const result = await runCommand(LSOF, args, { timeoutMs: 4_000, env: STABLE_ENV })
    // lsof uses exit 1 when a selection has no matching files.
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw new Error(`lsof failed: ${result.stderr.trim() || `exit ${String(result.exitCode)}`}`)
    }
    return parseLsofOutput(result.stdout, { protocol, family })
  }
}

export function parseLsofOutput(output: string, options: LsofParseOptions): RawEndpoint[] {
  const endpoints: RawEndpoint[] = []
  let pid: number | undefined
  let processName: string | undefined

  for (const line of output.split(/\r?\n/)) {
    const tag = line[0]
    const value = line.slice(1)
    if (tag === 'p') {
      const parsed = Number.parseInt(value, 10)
      pid = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
      processName = undefined
      continue
    }
    if (tag === 'c') {
      processName = value.trim() || undefined
      continue
    }
    if (tag !== 'n' || pid === undefined) continue

    const localName = value.split('->', 1)[0]?.trim()
    const parsedAddress = localName ? parseAddressAndPort(localName) : undefined
    if (!parsedAddress) continue

    endpoints.push(
      makeRawEndpoint({
        pid,
        port: parsedAddress.port,
        protocol: options.protocol,
        family: options.family,
        address: parsedAddress.address,
        ...(processName ? { processName } : {})
      })
    )
  }

  return endpoints
}

export function parseAddressAndPort(value: string): { address: string; port: number } | undefined {
  const bracketed = /^\[([^\]]+)]:(\d+)$/.exec(value)
  const match = bracketed ?? /^(.*):(\d+)$/.exec(value)
  if (!match) return undefined
  const address = match[1]?.trim()
  const port = Number.parseInt(match[2] ?? '', 10)
  if (!address || !Number.isInteger(port) || port < 1 || port > 65535) return undefined
  return { address, port }
}

export function parsePsOutput(output: string): Map<number, ProcessInfo> {
  const processes = new Map<number, ProcessInfo>()
  const pattern =
    /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$/

  for (const line of output.split(/\r?\n/)) {
    const match = pattern.exec(line)
    if (!match) continue
    const pid = Number.parseInt(match[1] ?? '', 10)
    const parentPid = Number.parseInt(match[2] ?? '', 10)
    const owner = match[3]
    const startedAt = match[4]
    const command = match[5]?.trim()
    if (!Number.isSafeInteger(pid) || pid < 1 || !command) continue
    const firstArgument = command.startsWith('"')
      ? /^"([^"]+)"/.exec(command)?.[1]
      : command.split(/\s+/, 1)[0]
    const executable = firstArgument || undefined
    const name = executable ? basename(executable) : `PID ${pid}`
    processes.set(pid, {
      pid,
      ...(Number.isSafeInteger(parentPid) ? { parentPid } : {}),
      ...(owner ? { owner } : {}),
      name,
      command,
      ...(executable ? { executable } : {}),
      ...(startedAt ? { startedAt } : {})
    })
  }

  return processes
}
