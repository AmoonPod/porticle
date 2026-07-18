/// <reference types="vite/client" />

import type { PorticleApi } from '../../shared/model'

declare global {
  interface Window {
    porticle?: PorticleApi
  }
}

export {}
