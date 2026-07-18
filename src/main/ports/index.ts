import type { PortDiscovery } from './types'
import { MacOsPortDiscovery } from './macos'
import { WindowsPortDiscovery } from './windows'

export function createPortDiscovery(protectedPids: () => ReadonlySet<number>): PortDiscovery {
  if (process.platform === 'darwin') return new MacOsPortDiscovery(protectedPids)
  if (process.platform === 'win32') return new WindowsPortDiscovery(protectedPids)
  throw new Error(`Porticle does not support ${process.platform}`)
}
