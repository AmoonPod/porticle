import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppInfo, AppSettings, PortSnapshot, UpdateState } from '../../../shared/model'
import { getPorticleApi } from '../api'

export function usePorticle(): {
  api: ReturnType<typeof getPorticleApi>
  snapshot?: PortSnapshot
  settings?: AppSettings
  appInfo?: AppInfo
  updateState?: UpdateState
  error?: string
  refreshAppInfo: () => Promise<void>
} {
  const api = useMemo(() => getPorticleApi(), [])
  const [snapshot, setSnapshot] = useState<PortSnapshot>()
  const [settings, setSettings] = useState<AppSettings>()
  const [appInfo, setAppInfo] = useState<AppInfo>()
  const [updateState, setUpdateState] = useState<UpdateState>()
  const [error, setError] = useState<string>()

  const refreshAppInfo = useCallback(async (): Promise<void> => {
    setAppInfo(await api.getAppInfo())
  }, [api])

  useEffect(() => {
    const unsubscribeSnapshot = api.onSnapshot(setSnapshot)
    const unsubscribeSettings = api.onSettings(setSettings)
    const unsubscribeUpdates = api.onUpdateState(setUpdateState)
    void Promise.all([api.getSnapshot(), api.getSettings(), api.getAppInfo(), api.getUpdateState()])
      .then(([nextSnapshot, nextSettings, nextInfo, nextUpdateState]) => {
        setSnapshot(nextSnapshot)
        setSettings(nextSettings)
        setAppInfo(nextInfo)
        setUpdateState(nextUpdateState)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Porticle could not start.')
      })
    return () => {
      unsubscribeSnapshot()
      unsubscribeSettings()
      unsubscribeUpdates()
    }
  }, [api])

  return {
    api,
    ...(snapshot ? { snapshot } : {}),
    ...(settings ? { settings } : {}),
    ...(appInfo ? { appInfo } : {}),
    ...(updateState ? { updateState } : {}),
    ...(error ? { error } : {}),
    refreshAppInfo
  }
}
