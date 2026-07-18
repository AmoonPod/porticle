import type { PorticleApi } from '../../../shared/model'
import { mockApi } from './mock'

export function getPorticleApi(): PorticleApi {
  if (window.porticle) return window.porticle
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') return mockApi
  throw new Error('The secure Porticle bridge is unavailable.')
}
