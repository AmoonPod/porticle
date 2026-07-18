import { app } from 'electron'
import { join } from 'node:path'

export function resourcePath(...segments: string[]): string {
  const root = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
  return join(root, ...segments)
}
