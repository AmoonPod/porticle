import { describe, expect, it } from 'vitest'
import {
  isProtectedWindowsProcess,
  parseWindowsEndpoints,
  parseWindowsProcesses
} from '../../src/main/ports/windows'

describe('Windows discovery parser', () => {
  const payload = {
    Endpoints: [
      { Address: '0.0.0.0', Port: 3000, Pid: 42, Protocol: 'tcp' },
      { Address: '::', Port: 5353, Pid: 80, Protocol: 'udp' },
      { Address: 'fe80::1%12', Port: 8080, Pid: 90, Protocol: 'tcp' },
      { Address: '127.0.0.1', Port: 0, Pid: 7, Protocol: 'tcp' }
    ],
    Processes: [
      {
        Pid: 42,
        ParentPid: 10,
        Name: 'node.exe',
        Command: 'node.exe vite --host',
        Executable: 'C:\\Program Files\\nodejs\\node.exe',
        StartedAt: '20260717180100.000000+120'
      }
    ]
  }

  it('normalizes any-addresses and preserves address families', () => {
    expect(parseWindowsEndpoints(payload)).toEqual([
      { pid: 42, port: 3000, protocol: 'tcp', family: 'ipv4', address: '*', state: 'listen' },
      { pid: 80, port: 5353, protocol: 'udp', family: 'ipv6', address: '*', state: 'bound' },
      { pid: 90, port: 8080, protocol: 'tcp', family: 'ipv6', address: 'fe80::1', state: 'listen' }
    ])
  })

  it('maps CIM process identity fields', () => {
    expect(parseWindowsProcesses(payload).get(42)).toEqual({
      pid: 42,
      parentPid: 10,
      name: 'node.exe',
      command: 'node.exe vite --host',
      executable: 'C:\\Program Files\\nodejs\\node.exe',
      startedAt: '20260717180100.000000+120'
    })
  })

  it('protects Windows kernel and service-host processes before actions reach taskkill', () => {
    expect(isProtectedWindowsProcess({ pid: 4, name: 'System' })).toBe(true)
    expect(isProtectedWindowsProcess({ pid: 912, name: 'svchost.exe' })).toBe(true)
    expect(isProtectedWindowsProcess({ pid: 42, name: 'node.exe' })).toBe(false)
  })
})
