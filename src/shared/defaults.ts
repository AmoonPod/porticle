import type { AppSettings } from './model'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  accent: '#ff5a36',
  refreshInterval: 2000,
  confirmBeforeKill: true,
  forceKillAfterMs: 1500,
  launchAtLogin: false,
  shortcutEnabled: true,
  globalShortcut: 'CommandOrControl+Alt+P',
  watchedPorts: [],
  notifications: true
}

export const APP_NAME = 'Porticle'
export const APP_ID = 'io.github.amoonpod.porticle'
