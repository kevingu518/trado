import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { SCOPE } from './scopes'

const STORAGE_KEY = 'trado_shortcuts_settings'

const DEFAULT_SETTINGS = {
  enabled: true,
  enabledScopes: {
    [SCOPE.GLOBAL]: true,
    [SCOPE.TRADES]: true,
    [SCOPE.STRATEGY]: true,
    [SCOPE.DASHBOARD]: true,
  },
}

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed.enabled ?? DEFAULT_SETTINGS.enabled,
      enabledScopes: { ...DEFAULT_SETTINGS.enabledScopes, ...(parsed.enabledScopes || {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const ShortcutSettingsContext = createContext(null)

export const ShortcutSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const setEnabled = useCallback((enabled) => {
    setSettings((prev) => ({ ...prev, enabled }))
  }, [])

  const setScopeEnabled = useCallback((scope, enabled) => {
    setSettings((prev) => ({
      ...prev,
      enabledScopes: { ...prev.enabledScopes, [scope]: enabled },
    }))
  }, [])

  const isShortcutEnabled = useCallback(
    (scope) => settings.enabled && (settings.enabledScopes[scope] ?? true),
    [settings],
  )

  const value = useMemo(
    () => ({ settings, setEnabled, setScopeEnabled, isShortcutEnabled }),
    [settings, setEnabled, setScopeEnabled, isShortcutEnabled],
  )

  return (
    <ShortcutSettingsContext.Provider value={value}>
      {children}
    </ShortcutSettingsContext.Provider>
  )
}

export const useShortcutSettings = () => {
  const ctx = useContext(ShortcutSettingsContext)
  if (!ctx) throw new Error('useShortcutSettings must be used inside ShortcutSettingsProvider')
  return ctx
}
