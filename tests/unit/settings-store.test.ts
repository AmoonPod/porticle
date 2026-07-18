import { describe, expect, it } from 'vitest'
import { normalizeSettings } from '../../src/main/settings/store'
import { DEFAULT_SETTINGS } from '../../src/shared/defaults'

describe('settings migrations', () => {
  it('replaces the obsolete Period accelerator and preserves custom shortcuts', () => {
    expect(
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        globalShortcut: 'CommandOrControl+Shift+Period'
      }).globalShortcut
    ).toBe('CommandOrControl+Alt+P')

    expect(
      normalizeSettings({
        ...DEFAULT_SETTINGS,
        globalShortcut: 'CommandOrControl+Shift+L'
      }).globalShortcut
    ).toBe('CommandOrControl+Shift+L')
  })
})
