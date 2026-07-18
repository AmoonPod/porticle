import { describe, expect, it } from 'vitest'
import { parseAddressAndPort, parseLsofOutput, parsePsOutput } from '../../src/main/ports/macos'

describe('macOS lsof parser', () => {
  it('extracts a listener and deduplicates later in normalization', () => {
    const output = [
      'p14043',
      'cnode',
      'f34',
      'PTCP',
      'n127.0.0.1:4321',
      'TST=LISTEN',
      'p14044',
      'cpython3',
      'n[::1]:8000'
    ].join('\n')

    expect(parseLsofOutput(output, { protocol: 'tcp', family: 'ipv4' })).toEqual([
      {
        pid: 14043,
        port: 4321,
        protocol: 'tcp',
        family: 'ipv4',
        address: '127.0.0.1',
        processName: 'node',
        state: 'listen'
      },
      {
        pid: 14044,
        port: 8000,
        protocol: 'tcp',
        family: 'ipv4',
        address: '::1',
        processName: 'python3',
        state: 'listen'
      }
    ])
  })

  it('keeps the local side of a connected UDP endpoint and ignores wildcard ports', () => {
    const output = [
      'p96300',
      'cChrome Helper',
      'PUDP',
      'n192.168.1.23:59132->8.8.8.8:443',
      'n*:*'
    ].join('\n')
    const endpoints = parseLsofOutput(output, { protocol: 'udp', family: 'ipv4' })
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]).toMatchObject({ port: 59132, address: '192.168.1.23', state: 'bound' })
  })

  it('parses IPv4, wildcard, and bracketed IPv6 addresses', () => {
    expect(parseAddressAndPort('*:5353')).toEqual({ address: '*', port: 5353 })
    expect(parseAddressAndPort('[fe80::1]:8080')).toEqual({ address: 'fe80::1', port: 8080 })
    expect(parseAddressAndPort('127.0.0.1:3000')).toEqual({ address: '127.0.0.1', port: 3000 })
    expect(parseAddressAndPort('*:*')).toBeUndefined()
    expect(parseAddressAndPort('localhost:70000')).toBeUndefined()
  })
})

describe('macOS process catalog parser', () => {
  it('preserves the full command and stable process start time', () => {
    const output = [
      '    1     0     0 Fri Jul 17 12:04:42 2026     /sbin/launchd',
      '14043   912   501 Fri Jul 17 18:11:05 2026     /opt/homebrew/bin/node ./node_modules/vite/bin/vite.js --host'
    ].join('\n')
    const catalog = parsePsOutput(output)
    expect(catalog.get(14043)).toEqual({
      pid: 14043,
      parentPid: 912,
      owner: '501',
      name: 'node',
      command: '/opt/homebrew/bin/node ./node_modules/vite/bin/vite.js --host',
      executable: '/opt/homebrew/bin/node',
      startedAt: 'Fri Jul 17 18:11:05 2026'
    })
  })
})
