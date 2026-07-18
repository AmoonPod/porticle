import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/defaults'
import { SettingsPanel } from '../../src/renderer/src/components/SettingsPanel'

describe('SettingsPanel updates', () => {
  it('offers an in-app download when an official release is available', () => {
    const onDownloadUpdate = vi.fn().mockResolvedValue(undefined)

    render(
      <SettingsPanel
        settings={DEFAULT_SETTINGS}
        appInfo={{
          version: '0.1.0',
          platform: 'darwin',
          packaged: true,
          shortcutRegistered: true
        }}
        updateState={{
          phase: 'available',
          currentVersion: '0.1.0',
          availableVersion: '0.2.0'
        }}
        onBack={vi.fn()}
        onChange={vi.fn().mockResolvedValue(undefined)}
        onCheckForUpdates={vi.fn().mockResolvedValue(undefined)}
        onDownloadUpdate={onDownloadUpdate}
        onInstallUpdate={vi.fn().mockResolvedValue(undefined)}
      />
    )

    expect(screen.getByText('v0.2.0 is ready to download.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(onDownloadUpdate).toHaveBeenCalledOnce()
  })
})
