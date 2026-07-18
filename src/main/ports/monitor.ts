import { EventEmitter } from 'node:events'
import type { PortRecord, PortSnapshot, ScanStatus } from '../../shared/model'
import type { PortDiscovery } from './types'

interface MonitorEvents {
  changed: [snapshot: PortSnapshot]
}

export class PortMonitor extends EventEmitter<MonitorEvents> {
  readonly #discovery: PortDiscovery
  #records: PortRecord[] = []
  #status: ScanStatus = { state: 'idle', revision: 0, warnings: [] }
  #timer: NodeJS.Timeout | undefined
  #inFlight: Promise<PortSnapshot> | undefined
  #rerunRequested = false
  #intervalMs = 2_000

  constructor(discovery: PortDiscovery) {
    super()
    this.#discovery = discovery
  }

  get snapshot(): PortSnapshot {
    return structuredClone({ records: this.#records, status: this.#status })
  }

  find(id: string): PortRecord | undefined {
    const record = this.#records.find((candidate) => candidate.id === id)
    return record ? structuredClone(record) : undefined
  }

  findEndpoint(endpointKey: string): PortRecord | undefined {
    const record = this.#records.find((candidate) => candidate.endpointKey === endpointKey)
    return record ? structuredClone(record) : undefined
  }

  start(intervalMs: number): void {
    this.#intervalMs = intervalMs
    this.#installTimer()
    void this.refresh()
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = undefined
  }

  setInterval(intervalMs: number): void {
    this.#intervalMs = intervalMs
    if (!this.#timer) return
    this.#installTimer()
  }

  #installTimer(): void {
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = setInterval(() => void this.refresh(), this.#intervalMs)
    this.#timer.unref()
  }

  async refresh(): Promise<PortSnapshot> {
    if (this.#inFlight) {
      this.#rerunRequested = true
      return this.#inFlight
    }

    this.#inFlight = this.#runScan()
    try {
      return await this.#inFlight
    } finally {
      this.#inFlight = undefined
      if (this.#rerunRequested) {
        this.#rerunRequested = false
        queueMicrotask(() => void this.refresh())
      }
    }
  }

  async #runScan(): Promise<PortSnapshot> {
    const started = performance.now()
    this.#status = {
      state: 'scanning',
      revision: this.#status.revision,
      warnings: this.#status.warnings,
      ...(this.#status.updatedAt ? { updatedAt: this.#status.updatedAt } : {}),
      ...(this.#status.durationMs !== undefined ? { durationMs: this.#status.durationMs } : {})
    }
    this.#emitChanged()

    try {
      const result = await this.#discovery.scan()
      this.#records = result.records
      this.#status = {
        state: 'ready',
        revision: this.#status.revision + 1,
        updatedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        warnings: result.warnings
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown port discovery error'
      const unsupported = message.startsWith('Porticle does not support')
      this.#status = {
        state: unsupported ? 'unsupported' : 'error',
        revision: this.#status.revision + 1,
        updatedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        warnings: [],
        error: message
      }
    }
    this.#emitChanged()
    return this.snapshot
  }

  #emitChanged(): void {
    this.emit('changed', this.snapshot)
  }
}
