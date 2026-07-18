import { ArrowLeft, Check, Command, Download, Moon, Monitor, RefreshCw, Sun } from 'lucide-react'
import { useState } from 'react'
import type {
  AppInfo,
  AppSettings,
  ForceKillDelay,
  RefreshInterval,
  ThemeMode,
  UpdateState
} from '../../../shared/model'
import { IconButton } from './IconButton'
import { Toggle } from './Toggle'

interface SettingsPanelProps {
  settings: AppSettings
  appInfo?: AppInfo
  updateState?: UpdateState
  onBack: () => void
  onChange: (patch: Partial<AppSettings>) => Promise<void>
  onCheckForUpdates: () => Promise<void>
  onDownloadUpdate: () => Promise<void>
  onInstallUpdate: () => Promise<void>
}

const ACCENTS = ['#ff5a36', '#e5484d', '#0f9f75', '#3276e8', '#a855f7'] as const

export function SettingsPanel({
  settings,
  appInfo,
  updateState,
  onBack,
  onChange,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate
}: SettingsPanelProps): React.JSX.Element {
  const [shortcut, setShortcut] = useState(settings.globalShortcut)

  const saveShortcut = (): void => {
    const normalized = shortcut.trim()
    if (normalized && normalized !== settings.globalShortcut) {
      void onChange({ globalShortcut: normalized })
    } else {
      setShortcut(settings.globalShortcut)
    }
  }

  return (
    <div className="settings-panel">
      <header className="panel-header">
        <IconButton icon={ArrowLeft} label="Back to ports" onClick={onBack} />
        <div>
          <span className="eyebrow">PORTICLE</span>
          <h1>Preferences</h1>
        </div>
      </header>

      <div className="settings-scroll">
        <section className="settings-section" aria-labelledby="appearance-heading">
          <h2 id="appearance-heading">Appearance</h2>
          <div className="theme-picker" role="group" aria-label="Theme">
            <ThemeButton
              value="system"
              current={settings.theme}
              icon={Monitor}
              onChange={(theme) => void onChange({ theme })}
            />
            <ThemeButton
              value="light"
              current={settings.theme}
              icon={Sun}
              onChange={(theme) => void onChange({ theme })}
            />
            <ThemeButton
              value="dark"
              current={settings.theme}
              icon={Moon}
              onChange={(theme) => void onChange({ theme })}
            />
          </div>
          <div className="setting-line accent-line">
            <span>
              <strong>Signal color</strong>
              <small>Used for selection and active states.</small>
            </span>
            <div className="accent-picker">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  className={`accent-swatch${settings.accent === accent ? ' is-active' : ''}`}
                  style={{ '--swatch': accent } as React.CSSProperties}
                  aria-label={`Use ${accent}`}
                  aria-pressed={settings.accent === accent}
                  onClick={() => void onChange({ accent })}
                >
                  {settings.accent === accent ? <Check aria-hidden="true" /> : null}
                </button>
              ))}
              <label className="custom-color" title="Choose custom color">
                <input
                  type="color"
                  value={settings.accent}
                  aria-label="Choose custom signal color"
                  onChange={(event) => void onChange({ accent: event.currentTarget.value })}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="behavior-heading">
          <h2 id="behavior-heading">Behavior</h2>
          <label className="setting-line">
            <span>
              <strong>Refresh</strong>
              <small>How often Porticle checks the local socket table.</small>
            </span>
            <select
              value={settings.refreshInterval}
              onChange={(event) =>
                void onChange({
                  refreshInterval: Number(event.currentTarget.value) as RefreshInterval
                })
              }
            >
              <option value={1000}>Every second</option>
              <option value={2000}>Every 2 sec</option>
              <option value={5000}>Every 5 sec</option>
              <option value={10000}>Every 10 sec</option>
            </select>
          </label>
          <Toggle
            checked={settings.launchAtLogin}
            onChange={(launchAtLogin) => void onChange({ launchAtLogin })}
            label="Launch at login"
            description="Start hidden in the menu bar or system tray."
          />
          <Toggle
            checked={settings.confirmBeforeKill}
            onChange={(confirmBeforeKill) => void onChange({ confirmBeforeKill })}
            label="Confirm before stopping"
            description="Turn off for the fastest one-click workflow."
          />
          <label className="setting-line">
            <span>
              <strong>Force fallback</strong>
              <small>Used only when graceful termination is ignored.</small>
            </span>
            <select
              value={settings.forceKillAfterMs}
              onChange={(event) =>
                void onChange({
                  forceKillAfterMs: Number(event.currentTarget.value) as ForceKillDelay
                })
              }
            >
              <option value={1500}>After 1.5 sec</option>
              <option value={3000}>After 3 sec</option>
              <option value={0}>Never</option>
            </select>
          </label>
        </section>

        <section className="settings-section" aria-labelledby="access-heading">
          <h2 id="access-heading">Quick access</h2>
          <Toggle
            checked={settings.shortcutEnabled}
            onChange={(shortcutEnabled) => void onChange({ shortcutEnabled })}
            label="Global shortcut"
            description="Toggle Porticle from any app."
          />
          {settings.shortcutEnabled ? (
            <label className="shortcut-field">
              <Command aria-hidden="true" />
              <input
                value={shortcut}
                spellCheck={false}
                aria-label="Electron global shortcut accelerator"
                onChange={(event) => setShortcut(event.currentTarget.value)}
                onBlur={saveShortcut}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
              <span className={appInfo?.shortcutRegistered ? 'status-good' : 'status-warn'}>
                {appInfo?.shortcutRegistered ? 'active' : 'unavailable'}
              </span>
            </label>
          ) : null}
          <Toggle
            checked={settings.notifications}
            onChange={(notifications) => void onChange({ notifications })}
            label="Watched-port notifications"
            description="Notify when a watched port opens, closes, or changes owner."
          />
        </section>

        <section className="settings-section about-section" aria-labelledby="about-heading">
          <h2 id="about-heading">About</h2>
          <div className="about-card">
            <span className="about-monogram">P:</span>
            <span>
              <strong>Porticle {appInfo ? `v${appInfo.version}` : ''}</strong>
              <small>Local-only. No account, daemon, telemetry, or automatic elevation.</small>
            </span>
          </div>
          {updateState ? (
            <UpdateControl
              state={updateState}
              packaged={appInfo?.packaged ?? false}
              onCheck={onCheckForUpdates}
              onDownload={onDownloadUpdate}
              onInstall={onInstallUpdate}
            />
          ) : null}
          <p>
            Protected processes remain protected. If the operating system denies a stop request,
            Porticle explains what happened and leaves elevation to you.
          </p>
        </section>
      </div>
    </div>
  )
}

interface UpdateControlProps {
  state: UpdateState
  packaged: boolean
  onCheck: () => Promise<void>
  onDownload: () => Promise<void>
  onInstall: () => Promise<void>
}

function UpdateControl({
  state,
  packaged,
  onCheck,
  onDownload,
  onInstall
}: UpdateControlProps): React.JSX.Element {
  const version = state.availableVersion ? `v${state.availableVersion}` : 'the latest version'
  const description = (() => {
    switch (state.phase) {
      case 'checking':
        return 'Checking the official GitHub release channel…'
      case 'up-to-date':
        return 'You are running the latest available release.'
      case 'available':
        return `${version} is ready to download.`
      case 'downloading':
        return `Downloading ${version} · ${state.progressPercent ?? 0}%`
      case 'downloaded':
        return `${version} is ready. Restart to finish.`
      case 'error':
        return state.message ?? 'The update check could not be completed.'
      case 'disabled':
        return state.message ?? 'Updates are available in packaged release builds.'
      default:
        return 'Updates are verified and delivered from GitHub Releases.'
    }
  })()

  return (
    <div className={`update-control update-control--${state.phase}`} role="status">
      <span>
        <strong>Software update</strong>
        <small>{description}</small>
      </span>
      {state.phase === 'available' ? (
        <button className="button button--update" type="button" onClick={() => void onDownload()}>
          <Download aria-hidden="true" /> Download
        </button>
      ) : state.phase === 'downloaded' ? (
        <button className="button button--update" type="button" onClick={() => void onInstall()}>
          <RefreshCw aria-hidden="true" /> Restart
        </button>
      ) : packaged && state.phase !== 'disabled' ? (
        <button
          className="button button--quiet"
          type="button"
          disabled={state.phase === 'checking' || state.phase === 'downloading'}
          onClick={() => void onCheck()}
        >
          {state.phase === 'downloading' ? `${state.progressPercent ?? 0}%` : 'Check'}
        </button>
      ) : null}
    </div>
  )
}

interface ThemeButtonProps {
  value: ThemeMode
  current: ThemeMode
  icon: React.ComponentType<{ 'aria-hidden'?: boolean }>
  onChange: (theme: ThemeMode) => void
}

function ThemeButton({
  value,
  current,
  icon: Icon,
  onChange
}: ThemeButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={current === value ? 'is-active' : ''}
      aria-pressed={current === value}
      onClick={() => onChange(value)}
    >
      <Icon aria-hidden={true} />
      {value[0]?.toUpperCase()}
      {value.slice(1)}
    </button>
  )
}
