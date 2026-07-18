import { describe, expect, it } from 'vitest'
import { settingsPatchSchema, terminateRequestSchema } from '../../src/shared/schemas'

describe('IPC schemas', () => {
  it('rejects unknown settings and invalid ports', () => {
    expect(settingsPatchSchema.safeParse({ refreshInterval: 3000 }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ unexpected: true }).success).toBe(false)
  })

  it('accepts a complete identity-bound termination request', () => {
    expect(
      terminateRequestSchema.safeParse({
        id: 'tcp:ipv4:*:3000:42',
        endpointKey: 'tcp:ipv4:*:3000',
        processToken: '42:start',
        pid: 42,
        port: 3000
      }).success
    ).toBe(true)
    expect(
      terminateRequestSchema.safeParse({
        id: 'x',
        endpointKey: 'x',
        processToken: 'x',
        pid: 0,
        port: 70000
      }).success
    ).toBe(false)
  })
})
