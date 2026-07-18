import {
  AlertTriangle,
  Command,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CopyField, PortRecord } from '../../shared/model'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { BrandMark } from './components/BrandMark'
import { IconButton } from './components/IconButton'
import { IdlePortRow } from './components/IdlePortRow'
import { KillDialog } from './components/KillDialog'
import { PortRow } from './components/PortRow'
import { SettingsPanel } from './components/SettingsPanel'
import { Toast, type ToastMessage, type ToastTone } from './components/Toast'
import { usePorticle } from './hooks/usePorticle'

type Filter = 'all' | 'tcp' | 'udp' | 'watched'

const EMPTY_RECORDS: PortRecord[] = []

export function App(): React.JSX.Element {
  const {
    api,
    snapshot,
    settings: loadedSettings,
    appInfo,
    updateState,
    error,
    refreshAppInfo
  } = usePorticle()
  const settings = loadedSettings ?? DEFAULT_SETTINGS
  const records = snapshot?.records ?? EMPTY_RECORDS
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string>()
  const [expandedId, setExpandedId] = useState<string>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingKill, setPendingKill] = useState<PortRecord>()
  const [killingId, setKillingId] = useState<string>()
  const [toast, setToast] = useState<ToastMessage>()
  const toastId = useRef(0)
  const searchInput = useRef<HTMLInputElement>(null)

  const focusSearch = useCallback((): void => {
    searchInput.current?.focus()
    searchInput.current?.select()
  }, [])

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastId.current
    setToast({ id, message, tone })
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? undefined : current))
    }, 3_200)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = (): void => {
      const resolved =
        settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.setProperty('--accent', settings.accent)
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [settings.accent, settings.theme])

  const watchedPorts = useMemo(() => new Set(settings.watchedPorts), [settings.watchedPorts])
  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return records.filter((record) => {
      const filterMatches =
        filter === 'all' ||
        filter === record.protocol ||
        (filter === 'watched' && watchedPorts.has(record.port))
      if (!filterMatches) return false
      if (!normalizedQuery) return true
      const searchable = [
        record.port,
        record.pid,
        record.address,
        record.protocol,
        record.family,
        record.processName,
        record.command,
        record.service?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return searchable.includes(normalizedQuery)
    })
  }, [filter, query, records, watchedPorts])

  const watchedRecords = useMemo(
    () => filteredRecords.filter((record) => watchedPorts.has(record.port)),
    [filteredRecords, watchedPorts]
  )
  const activeRecords = useMemo(
    () => filteredRecords.filter((record) => !watchedPorts.has(record.port)),
    [filteredRecords, watchedPorts]
  )
  const activePortNumbers = useMemo(() => new Set(records.map((record) => record.port)), [records])
  const idleWatchedPorts = settings.watchedPorts.filter((port) => {
    if (activePortNumbers.has(port) || (filter !== 'all' && filter !== 'watched')) return false
    const normalizedQuery = query.trim()
    return !normalizedQuery || String(port).includes(normalizedQuery)
  })
  const visibleRecords = useMemo(
    () => [...watchedRecords, ...activeRecords],
    [activeRecords, watchedRecords]
  )
  const visibleKey = visibleRecords.map((record) => record.id).join('|')
  const effectiveSelectedId = visibleRecords.some((record) => record.id === selectedId)
    ? selectedId
    : visibleRecords[0]?.id
  const selectedRecord = records.find((record) => record.id === effectiveSelectedId)

  useEffect(() => {
    if (!effectiveSelectedId) return
    document
      .querySelector(`[data-record-id="${CSS.escape(effectiveSelectedId)}"]`)
      ?.scrollIntoView({
        block: 'nearest'
      })
  }, [effectiveSelectedId])

  const copyRecord = useCallback(
    async (record: PortRecord, field: CopyField): Promise<void> => {
      const result = await api.copy({ id: record.id, field })
      notify(
        result.ok ? `${copyLabel(field)} copied` : (result.message ?? 'Could not copy'),
        result.ok ? 'success' : 'warning'
      )
    },
    [api, notify]
  )

  const openRecord = useCallback(
    async (record: PortRecord): Promise<void> => {
      const result = await api.open({ id: record.id })
      if (!result.ok) notify(result.message ?? 'Could not open this service', 'warning')
    },
    [api, notify]
  )

  const toggleWatch = useCallback(
    async (port: number): Promise<void> => {
      const watched = !settings.watchedPorts.includes(port)
      await api.setWatched({ port, watched })
      notify(watched ? `Watching port ${port}` : `Stopped watching port ${port}`, 'success')
    },
    [api, notify, settings.watchedPorts]
  )

  const executeTerminate = useCallback(
    async (record: PortRecord): Promise<void> => {
      setKillingId(record.id)
      try {
        const result = await api.terminate({
          id: record.id,
          endpointKey: record.endpointKey,
          processToken: record.processToken,
          pid: record.pid,
          port: record.port
        })
        const successful = ['terminated', 'force-terminated', 'already-stopped'].includes(
          result.outcome
        )
        notify(result.message, successful ? 'success' : 'warning')
        setExpandedId(undefined)
      } catch (cause) {
        notify(
          cause instanceof Error ? cause.message : 'The process could not be stopped.',
          'warning'
        )
      } finally {
        setKillingId(undefined)
        setPendingKill(undefined)
      }
    },
    [api, notify]
  )

  const requestStop = useCallback(
    (record: PortRecord): void => {
      if (record.protected) {
        notify('This process is protected by the operating system.', 'warning')
        return
      }
      if (settings.confirmBeforeKill) setPendingKill(record)
      else void executeTerminate(record)
    },
    [executeTerminate, notify, settings.confirmBeforeKill]
  )

  const refresh = useCallback(async (): Promise<void> => {
    try {
      await api.refresh()
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Refresh failed.', 'warning')
    }
  }, [api, notify])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const isEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true

      if (event.key === 'Escape') {
        if (pendingKill) setPendingKill(undefined)
        else if (settingsOpen) setSettingsOpen(false)
        else if (expandedId) setExpandedId(undefined)
        else void api.hide()
        return
      }
      if (settingsOpen || pendingKill) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        focusSearch()
        return
      }
      if (isEditing) return
      if (event.key === '/') {
        event.preventDefault()
        focusSearch()
        return
      }
      if (event.key === 'r') {
        event.preventDefault()
        void refresh()
        return
      }

      const currentIndex = visibleRecords.findIndex((record) => record.id === effectiveSelectedId)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (visibleRecords.length === 0) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex = Math.max(0, Math.min(visibleRecords.length - 1, currentIndex + delta))
        setSelectedId(visibleRecords[nextIndex]?.id)
        return
      }
      if (!selectedRecord) return
      if (event.key === 'Enter') {
        event.preventDefault()
        setExpandedId((current) => (current === selectedRecord.id ? undefined : selectedRecord.id))
      } else if (event.key.toLowerCase() === 'o' && selectedRecord.service?.url) {
        event.preventDefault()
        void openRecord(selectedRecord)
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void copyRecord(selectedRecord, selectedRecord.service?.url ? 'url' : 'port')
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        void toggleWatch(selectedRecord.port)
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        requestStop(selectedRecord)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    api,
    copyRecord,
    expandedId,
    focusSearch,
    openRecord,
    pendingKill,
    refresh,
    requestStop,
    effectiveSelectedId,
    selectedRecord,
    settingsOpen,
    toggleWatch,
    visibleKey,
    visibleRecords
  ])

  const updateSettings = async (patch: Parameters<typeof api.updateSettings>[0]): Promise<void> => {
    try {
      await api.updateSettings(patch)
      await refreshAppInfo()
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Could not save this preference.', 'warning')
    }
  }

  if (!snapshot || !loadedSettings) {
    return (
      <main className="loading-shell">
        <BrandMark size={38} />
        <LoaderCircle className="spin" aria-hidden="true" />
        <span>{error ?? 'Finding local ports…'}</span>
      </main>
    )
  }

  return (
    <main className="app-shell">
      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          {...(appInfo ? { appInfo } : {})}
          {...(updateState ? { updateState } : {})}
          onBack={() => setSettingsOpen(false)}
          onChange={updateSettings}
          onCheckForUpdates={async () => {
            await api.checkForUpdates()
          }}
          onDownloadUpdate={async () => {
            await api.downloadUpdate()
          }}
          onInstallUpdate={async () => {
            await api.installUpdate()
          }}
        />
      ) : (
        <>
          <header className="app-header">
            <div className="brand-lockup">
              <BrandMark size={28} />
              <div>
                <span className="brand-name">PORTICLE</span>
                <span className="brand-status">
                  <i /> {records.length} active {records.length === 1 ? 'port' : 'ports'}
                </span>
              </div>
            </div>
            <div className="window-actions">
              <IconButton
                icon={RefreshCw}
                label="Refresh ports (R)"
                className={snapshot.status.state === 'scanning' ? 'is-spinning' : ''}
                onClick={() => void refresh()}
              />
              <IconButton
                icon={SettingsIcon}
                label="Preferences"
                onClick={() => setSettingsOpen(true)}
              />
              <IconButton icon={X} label="Hide Porticle" onClick={() => void api.hide()} />
            </div>
          </header>

          <section className="command-area" aria-label="Search and filters">
            <div className="search-field">
              <Search aria-hidden="true" />
              <input
                ref={searchInput}
                value={query}
                type="search"
                spellCheck={false}
                placeholder="Port, process, command…"
                aria-label="Search ports"
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {query ? (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => {
                    setQuery('')
                    focusSearch()
                  }}
                  aria-label="Clear search"
                >
                  <X aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="search-shortcut"
                  aria-label={
                    appInfo?.platform === 'win32'
                      ? 'Focus port search (Control K)'
                      : 'Focus port search (Command K)'
                  }
                  title={
                    appInfo?.platform === 'win32' ? 'Focus search (Ctrl K)' : 'Focus search (⌘K)'
                  }
                  onClick={focusSearch}
                >
                  {appInfo?.platform === 'win32' ? (
                    'Ctrl K'
                  ) : (
                    <>
                      <Command aria-hidden="true" />K
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="filter-row" role="group" aria-label="Filter by protocol">
              {(['all', 'tcp', 'udp', 'watched'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? 'is-active' : ''}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === 'watched'
                    ? `Watched ${settings.watchedPorts.length}`
                    : value.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          {snapshot.status.error || error ? (
            <div className="status-banner status-banner--error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>
                <strong>Port scan failed</strong>
                {snapshot.status.error ?? error}
              </span>
              <button type="button" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          ) : snapshot.status.warnings.length > 0 ? (
            <div className="status-banner" role="status">
              <ShieldCheck aria-hidden="true" />
              <span>{snapshot.status.warnings[0]}</span>
            </div>
          ) : null}

          <div className="port-list" aria-label="Local ports">
            {watchedRecords.length > 0 || idleWatchedPorts.length > 0 ? (
              <section className="port-group" aria-labelledby="watched-heading">
                <div className="group-heading" id="watched-heading">
                  <span>WATCHED</span>
                  <span>{watchedRecords.length + idleWatchedPorts.length}</span>
                </div>
                {watchedRecords.map((record) => (
                  <PortRow
                    key={record.id}
                    record={record}
                    watched
                    selected={selectedId === record.id}
                    expanded={expandedId === record.id}
                    busy={killingId === record.id}
                    onSelect={() => setSelectedId(record.id)}
                    onToggle={() =>
                      setExpandedId((current) => (current === record.id ? undefined : record.id))
                    }
                    onCopy={(field) => void copyRecord(record, field)}
                    onOpen={() => void openRecord(record)}
                    onWatch={() => void toggleWatch(record.port)}
                    onStop={() => requestStop(record)}
                  />
                ))}
                {idleWatchedPorts.map((port) => (
                  <IdlePortRow key={port} port={port} onUnwatch={() => void toggleWatch(port)} />
                ))}
              </section>
            ) : null}

            {activeRecords.length > 0 ? (
              <section className="port-group" aria-labelledby="active-heading">
                <div className="group-heading" id="active-heading">
                  <span>{query || filter !== 'all' ? 'MATCHING' : 'ACTIVE'}</span>
                  <span>{activeRecords.length}</span>
                </div>
                {activeRecords.map((record) => (
                  <PortRow
                    key={record.id}
                    record={record}
                    watched={false}
                    selected={selectedId === record.id}
                    expanded={expandedId === record.id}
                    busy={killingId === record.id}
                    onSelect={() => setSelectedId(record.id)}
                    onToggle={() =>
                      setExpandedId((current) => (current === record.id ? undefined : record.id))
                    }
                    onCopy={(field) => void copyRecord(record, field)}
                    onOpen={() => void openRecord(record)}
                    onWatch={() => void toggleWatch(record.port)}
                    onStop={() => requestStop(record)}
                  />
                ))}
              </section>
            ) : null}

            {visibleRecords.length === 0 && idleWatchedPorts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-glyph">:{query ? '?' : '—'}</span>
                <strong>
                  {query || filter !== 'all' ? 'No matching ports' : 'No active ports'}
                </strong>
                <p>
                  {query || filter !== 'all'
                    ? 'Try another process, PID, port, or protocol.'
                    : 'Porticle will update as soon as a local service starts listening.'}
                </p>
                {query || filter !== 'all' ? (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => {
                      setQuery('')
                      setFilter('all')
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <footer className="app-footer">
            <span>{statusText(snapshot.status)}</span>
          </footer>
        </>
      )}

      {pendingKill ? (
        <KillDialog
          record={pendingKill}
          settings={settings}
          busy={killingId === pendingKill.id}
          onCancel={() => setPendingKill(undefined)}
          onConfirm={() => void executeTerminate(pendingKill)}
        />
      ) : null}
      {toast ? <Toast toast={toast} onDismiss={() => setToast(undefined)} /> : null}
    </main>
  )
}

function copyLabel(field: CopyField): string {
  return field === 'pid'
    ? 'PID'
    : field === 'url'
      ? 'Localhost URL'
      : field[0]?.toUpperCase() + field.slice(1)
}

function statusText(
  status: NonNullable<ReturnType<typeof usePorticle>['snapshot']>['status']
): string {
  if (status.state === 'scanning') return 'Scanning local sockets…'
  if (!status.updatedAt) return 'Waiting for first scan…'
  const elapsed = Math.max(0, Date.now() - new Date(status.updatedAt).getTime())
  const freshness = elapsed < 5_000 ? 'just now' : `${Math.floor(elapsed / 1_000)}s ago`
  return `Updated ${freshness}${status.durationMs === undefined ? '' : ` · ${status.durationMs} ms`}`
}
