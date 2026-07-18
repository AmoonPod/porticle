import { describe, expect, it, vi } from 'vitest'
import { PortMonitor } from '../../src/main/ports/monitor'
import type { DiscoveryResult, PortDiscovery } from '../../src/main/ports/types'
import type { PortRecord } from '../../src/shared/model'

const record: PortRecord = {
  id: 'tcp:ipv4:127.0.0.1:5173:42',
  endpointKey: 'tcp:ipv4:127.0.0.1:5173',
  processToken: '42:start-token',
  port: 5173,
  protocol: 'tcp',
  family: 'ipv4',
  address: '127.0.0.1',
  scope: 'loopback',
  state: 'listen',
  pid: 42,
  processName: 'node',
  protected: false
}

const emptyResult = (): DiscoveryResult => ({ records: [], processes: new Map(), warnings: [] })

describe('PortMonitor', () => {
  it('never overlaps scans and coalesces concurrent refreshes into one rerun', async () => {
    const first = deferred<DiscoveryResult>()
    const scan = vi
      .fn<PortDiscovery['scan']>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ records: [record], processes: new Map(), warnings: [] })
    const monitor = new PortMonitor({
      scan,
      processCatalog: vi.fn(() => Promise.resolve(new Map()))
    })
    const states: string[] = []
    monitor.on('changed', (snapshot) => states.push(snapshot.status.state))

    const firstRefresh = monitor.refresh()
    const concurrentRefresh = monitor.refresh()
    expect(scan).toHaveBeenCalledTimes(1)

    first.resolve(emptyResult())
    await Promise.all([firstRefresh, concurrentRefresh])
    await vi.waitFor(() => expect(scan).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(monitor.snapshot.status.revision).toBe(2))

    expect(monitor.snapshot.records).toEqual([record])
    expect(states).toEqual(['scanning', 'ready', 'scanning', 'ready'])
  })

  it('keeps the monitor alive and reports discovery failures', async () => {
    const monitor = new PortMonitor({
      scan: vi.fn(() => Promise.reject(new Error('socket table unavailable'))),
      processCatalog: vi.fn(() => Promise.resolve(new Map()))
    })

    const snapshot = await monitor.refresh()

    expect(snapshot.status).toMatchObject({
      state: 'error',
      revision: 1,
      error: 'socket table unavailable'
    })
    expect(snapshot.records).toEqual([])
  })
})

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
