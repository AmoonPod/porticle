import { EventEmitter } from 'node:events'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppSettings } from '../../shared/model'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { settingsPatchSchema, settingsSchema } from '../../shared/schemas'

interface SettingsEvents {
  changed: [settings: AppSettings]
}

export class SettingsStore extends EventEmitter<SettingsEvents> {
  readonly #filePath: string
  #settings: AppSettings = structuredClone(DEFAULT_SETTINGS)
  #writeQueue: Promise<void> = Promise.resolve()

  constructor(userDataPath: string) {
    super()
    this.#filePath = join(userDataPath, 'settings.json')
  }

  get value(): AppSettings {
    return structuredClone(this.#settings)
  }

  async load(): Promise<AppSettings> {
    try {
      const contents = await readFile(this.#filePath, 'utf8')
      const parsed: unknown = JSON.parse(contents)
      const settings = settingsSchema.parse({ ...DEFAULT_SETTINGS, ...(parsed as object) })
      const normalized = normalizeSettings(settings)
      this.#settings = normalized
      if (normalized.globalShortcut !== settings.globalShortcut) await this.#persist()
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : undefined
      if (code !== 'ENOENT') {
        const invalidPath = `${this.#filePath}.invalid-${Date.now()}`
        await rename(this.#filePath, invalidPath).catch(() => undefined)
      }
      this.#settings = structuredClone(DEFAULT_SETTINGS)
      await this.#persist()
    }
    return this.value
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const validatedPatch = settingsPatchSchema.parse(patch)
    const next = normalizeSettings(settingsSchema.parse({ ...this.#settings, ...validatedPatch }))
    this.#settings = next
    await this.#persist()
    const value = this.value
    this.emit('changed', value)
    return value
  }

  #persist(): Promise<void> {
    const snapshot = JSON.stringify(this.#settings, null, 2) + '\n'
    this.#writeQueue = this.#writeQueue.then(async () => {
      await mkdir(dirname(this.#filePath), { recursive: true })
      const temporaryPath = `${this.#filePath}.${process.pid}.tmp`
      await writeFile(temporaryPath, snapshot, { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, this.#filePath)
    })
    return this.#writeQueue
  }
}

export function normalizeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    globalShortcut:
      settings.globalShortcut === 'CommandOrControl+Shift+Period'
        ? DEFAULT_SETTINGS.globalShortcut
        : settings.globalShortcut,
    watchedPorts: [...new Set(settings.watchedPorts)].sort((left, right) => left - right),
    accent: settings.accent.toLowerCase()
  }
}
