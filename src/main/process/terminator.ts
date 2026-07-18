import { join } from 'node:path'
import type { AppSettings, PortRecord, TerminateRequest, TerminateResult } from '../../shared/model'
import { processToken } from '../ports/normalize'
import type { PortDiscovery, ProcessInfo } from '../ports/types'
import { runCommand } from '../system/command'

const settle = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds)
    timer.unref()
  })

export class ProcessTerminator {
  readonly #discovery: PortDiscovery
  readonly #settings: () => AppSettings
  readonly #protectedPids: () => ReadonlySet<number>

  constructor(
    discovery: PortDiscovery,
    settings: () => AppSettings,
    protectedPids: () => ReadonlySet<number>
  ) {
    this.#discovery = discovery
    this.#settings = settings
    this.#protectedPids = protectedPids
  }

  async terminate(request: TerminateRequest): Promise<TerminateResult> {
    const fresh = await this.#discovery.scan()
    const current = fresh.records.find((record) => record.id === request.id)

    if (!current) {
      const replacement = fresh.records.find((record) => record.endpointKey === request.endpointKey)
      if (replacement) return this.#staleResult(request, replacement)
      return {
        outcome: 'already-stopped',
        message: `Port ${request.port} is already free.`,
        pid: request.pid,
        port: request.port
      }
    }

    if (
      current.pid !== request.pid ||
      current.port !== request.port ||
      current.processToken !== request.processToken
    ) {
      return this.#staleResult(request, current)
    }

    if (current.protected || this.#protectedPids().has(current.pid) || current.pid <= 1) {
      return {
        outcome: 'protected',
        message: `${current.processName} is protected. Porticle will not attempt to stop it.`,
        pid: current.pid,
        port: current.port
      }
    }

    const forceImmediately = request.force === true
    try {
      await this.#signal(current, fresh.processes, forceImmediately)
    } catch (error) {
      return this.#signalError(current, error)
    }

    let forced = forceImmediately
    if (!forceImmediately) {
      const delay = this.#settings().forceKillAfterMs
      await settle(delay === 0 ? 500 : delay)
      const stillRunning = await this.#sameProcessExists(current)
      if (stillRunning && delay > 0) {
        try {
          const latestProcesses = await this.#discovery.processCatalog()
          await this.#signal(current, latestProcesses, true)
          forced = true
          await settle(250)
        } catch (error) {
          return this.#signalError(current, error)
        }
      } else if (stillRunning) {
        return {
          outcome: 'failed',
          message: `${current.processName} ignored the graceful stop. Use Force stop to end it.`,
          pid: current.pid,
          port: current.port
        }
      }
    } else {
      await settle(200)
    }

    const after = await this.#discovery.scan()
    const reopened = after.records.find((record) => record.endpointKey === current.endpointKey)
    if (reopened) {
      if (reopened.processToken === current.processToken) {
        return {
          outcome: 'failed',
          message: `${current.processName} is still using port ${current.port}.`,
          pid: current.pid,
          port: current.port
        }
      }
      return {
        outcome: 'reopened',
        message: `Port ${current.port} reopened under ${reopened.processName} (PID ${reopened.pid}).`,
        pid: current.pid,
        port: current.port,
        replacement: {
          pid: reopened.pid,
          processName: reopened.processName,
          processToken: reopened.processToken
        }
      }
    }

    return {
      outcome: forced ? 'force-terminated' : 'terminated',
      message: forced
        ? `Force-stopped ${current.processName} and freed port ${current.port}.`
        : `Stopped ${current.processName} and freed port ${current.port}.`,
      pid: current.pid,
      port: current.port
    }
  }

  async #signal(
    record: PortRecord,
    processes: ReadonlyMap<number, ProcessInfo>,
    force: boolean
  ): Promise<void> {
    if (process.platform === 'win32') {
      const windowsRoot = process.env.SystemRoot ?? 'C:\\Windows'
      const taskkill = join(windowsRoot, 'System32', 'taskkill.exe')
      const args = ['/PID', String(record.pid), '/T']
      if (force) args.push('/F')
      const result = await runCommand(taskkill, args, { timeoutMs: 6_000 })
      if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || result.stdout.trim() || 'taskkill failed')
      }
      return
    }

    if (process.platform !== 'darwin') throw new Error('Process termination is unsupported here')
    const signal: NodeJS.Signals = force ? 'SIGKILL' : 'SIGTERM'
    const descendants = collectDescendants(record.pid, processes)
    process.kill(record.pid, signal)
    for (const pid of descendants) {
      if (this.#protectedPids().has(pid) || pid <= 1) continue
      try {
        process.kill(pid, signal)
      } catch (error) {
        if (!isMissingProcess(error)) throw error
      }
    }
  }

  async #sameProcessExists(record: PortRecord): Promise<boolean> {
    const processes = await this.#discovery.processCatalog()
    const current = processes.get(record.pid)
    return current !== undefined && processToken(current, record.pid) === record.processToken
  }

  #staleResult(request: TerminateRequest, replacement: PortRecord): TerminateResult {
    return {
      outcome: 'stale',
      message: `Port ${request.port} changed owners before it could be stopped. The list has been refreshed.`,
      pid: request.pid,
      port: request.port,
      replacement: {
        pid: replacement.pid,
        processName: replacement.processName,
        processToken: replacement.processToken
      }
    }
  }

  #signalError(record: PortRecord, error: unknown): TerminateResult {
    const message = error instanceof Error ? error.message : String(error)
    const permissionDenied =
      (error instanceof Error && 'code' in error && error.code === 'EPERM') ||
      /access is denied|permission denied|not permitted/i.test(message)
    return {
      outcome: permissionDenied ? 'permission-denied' : 'failed',
      message: permissionDenied
        ? `macOS or Windows denied permission to stop ${record.processName}. Porticle never elevates itself; stop the process from an administrator terminal if you trust it.`
        : `Could not stop ${record.processName}: ${message}`,
      pid: record.pid,
      port: record.port
    }
  }
}

export function collectDescendants(
  rootPid: number,
  processes: ReadonlyMap<number, ProcessInfo>
): number[] {
  const children = new Map<number, number[]>()
  for (const item of processes.values()) {
    if (item.parentPid === undefined || item.pid === rootPid) continue
    const siblings = children.get(item.parentPid) ?? []
    siblings.push(item.pid)
    children.set(item.parentPid, siblings)
  }

  const result: number[] = []
  const visited = new Set<number>([rootPid])
  const visit = (pid: number): void => {
    for (const child of children.get(pid) ?? []) {
      if (visited.has(child)) continue
      visited.add(child)
      visit(child)
      result.push(child)
    }
  }
  visit(rootPid)
  return result
}

function isMissingProcess(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH'
}
