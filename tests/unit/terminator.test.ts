import { describe, expect, it, vi } from 'vitest'
import type { PortDiscovery } from '../../src/main/ports/types'
import { ProcessTerminator, collectDescendants } from '../../src/main/process/terminator'
import { DEFAULT_SETTINGS } from '../../src/shared/defaults'
import type { PortRecord, TerminateRequest } from '../../src/shared/model'

describe('process tree collection', () => {
  it('returns a deepest-first tree and breaks cycles', () => {
    const processes = new Map([
      [10, { pid: 10, parentPid: 1, name: 'root' }],
      [11, { pid: 11, parentPid: 10, name: 'child-a' }],
      [12, { pid: 12, parentPid: 10, name: 'child-b' }],
      [13, { pid: 13, parentPid: 11, name: 'grandchild' }],
      [14, { pid: 14, parentPid: 14, name: 'self-cycle' }]
    ])
    expect(collectDescendants(10, processes)).toEqual([13, 11, 12])
  })
})

const record: PortRecord = {
  id: 'tcp:ipv4:*:3000:42',
  endpointKey: 'tcp:ipv4:*:3000',
  processToken: '42:start-a',
  port: 3000,
  protocol: 'tcp',
  family: 'ipv4',
  address: '*',
  scope: 'any',
  state: 'listen',
  pid: 42,
  processName: 'node',
  protected: false
}

const request: TerminateRequest = {
  id: record.id,
  endpointKey: record.endpointKey,
  processToken: record.processToken,
  pid: record.pid,
  port: record.port
}

describe('termination revalidation', () => {
  it('does nothing when a port disappeared before the action arrived', async () => {
    const terminator = createTerminator([])

    await expect(terminator.terminate(request)).resolves.toMatchObject({
      outcome: 'already-stopped',
      pid: 42,
      port: 3000
    })
  })

  it('rejects a stale action when the endpoint changed owners', async () => {
    const replacement = {
      ...record,
      id: 'tcp:ipv4:*:3000:99',
      pid: 99,
      processToken: '99:start-b',
      processName: 'bun'
    }
    const terminator = createTerminator([replacement])

    await expect(terminator.terminate(request)).resolves.toMatchObject({
      outcome: 'stale',
      replacement: { pid: 99, processName: 'bun', processToken: '99:start-b' }
    })
  })

  it('never signals a protected process even when its identity still matches', async () => {
    const terminator = createTerminator([{ ...record, protected: true }])

    await expect(terminator.terminate(request)).resolves.toMatchObject({
      outcome: 'protected',
      pid: 42,
      port: 3000
    })
  })
})

function createTerminator(records: PortRecord[]): ProcessTerminator {
  const discovery: PortDiscovery = {
    scan: vi.fn(() => Promise.resolve({ records, processes: new Map(), warnings: [] })),
    processCatalog: vi.fn(() => Promise.resolve(new Map()))
  }
  return new ProcessTerminator(
    discovery,
    () => DEFAULT_SETTINGS,
    () => new Set()
  )
}
