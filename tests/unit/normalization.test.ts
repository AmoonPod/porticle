import { describe, expect, it } from 'vitest'
import { addressScope, normalizeEndpoints } from '../../src/main/ports/normalize'
import { recognizeService } from '../../src/main/ports/services'

describe('endpoint normalization', () => {
  it('classifies local address scopes', () => {
    expect(addressScope('*')).toBe('any')
    expect(addressScope('0.0.0.0')).toBe('any')
    expect(addressScope('::1')).toBe('loopback')
    expect(addressScope('127.0.0.42')).toBe('loopback')
    expect(addressScope('192.168.1.10')).toBe('lan')
    expect(addressScope('8.8.8.8')).toBe('unknown')
  })

  it('deduplicates file descriptors without merging different processes', () => {
    const endpoint = {
      pid: 10,
      port: 5173,
      protocol: 'tcp' as const,
      family: 'ipv4' as const,
      address: '*',
      processName: 'node',
      state: 'listen' as const
    }
    const processes = new Map([
      [
        10,
        {
          pid: 10,
          parentPid: 2,
          owner: '501',
          name: 'node',
          command: 'node vite',
          startedAt: 'start-a'
        }
      ]
    ])
    const records = normalizeEndpoints([endpoint, endpoint], processes, new Set(), 501)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      id: 'tcp:ipv4:*:5173:10',
      endpointKey: 'tcp:ipv4:*:5173',
      processToken: '10:start-a',
      protected: false,
      service: { id: 'vite', name: 'Vite', url: 'http://localhost:5173' }
    })
  })

  it('marks root-owned listeners as protected for a regular user', () => {
    const records = normalizeEndpoints(
      [{ pid: 91, port: 80, protocol: 'tcp', family: 'ipv4', address: '*', state: 'listen' }],
      new Map([[91, { pid: 91, owner: '0', name: 'system-http' }]]),
      new Set(),
      501
    )
    expect(records[0]?.protected).toBe(true)
  })
})

describe('service recognition', () => {
  it('prefers process signatures and makes web URLs only for TCP', () => {
    expect(
      recognizeService({ port: 4000, protocol: 'tcp', processName: 'node', command: 'next dev' })
    ).toMatchObject({ id: 'next', url: 'http://localhost:4000' })
    expect(recognizeService({ port: 6379, protocol: 'tcp', processName: 'redis-server' })).toEqual({
      id: 'redis',
      name: 'Redis',
      category: 'cache'
    })
    expect(
      recognizeService({ port: 8080, protocol: 'udp', processName: 'custom' })?.url
    ).toBeUndefined()
  })

  it('opens the RabbitMQ management UI without treating AMQP as HTTP', () => {
    expect(recognizeService({ port: 15672, protocol: 'tcp', processName: 'beam.smp' })).toEqual({
      id: 'rabbitmq-management',
      name: 'RabbitMQ Management',
      category: 'queue',
      url: 'http://localhost:15672'
    })
    expect(recognizeService({ port: 5672, protocol: 'tcp', processName: 'beam.smp' })).toEqual({
      id: 'rabbitmq',
      name: 'RabbitMQ',
      category: 'queue'
    })
  })
})
