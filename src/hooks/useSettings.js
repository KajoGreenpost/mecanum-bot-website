import { useState, useCallback, useRef } from 'react'
import { vehicleApi } from '../api/vehicleApi.js'

export function useSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const loadInFlight = useRef(null)
  const saveInFlight = useRef(null)

  const load = useCallback(() => {
    if (loadInFlight.current) return loadInFlight.current
    setLoading(true)
    loadInFlight.current = vehicleApi.getSettings()
      .then(data => {
        setSettings(data)
        setLoading(false)
        return data
      })
      .catch(err => {
        setLoading(false)
        throw err
      })
      .finally(() => { loadInFlight.current = null })
    return loadInFlight.current
  }, [])

  const save = useCallback((data) => {
    if (saveInFlight.current) return saveInFlight.current
    setSaving(true)
    saveInFlight.current = vehicleApi.saveSettings(data)
      .then(saved => {
        setSettings(saved || data)
        setSaving(false)
      })
      .catch(err => {
        setSaving(false)
        throw err
      })
      .finally(() => { saveInFlight.current = null })
    return saveInFlight.current
  }, [])

  const resetSimulation = useCallback(() => {
    if (vehicleApi.sim.resetSettings) {
      vehicleApi.sim.resetSettings()
    }
  }, [])

  return { settings, loading, saving, load, save, resetSimulation }
}
