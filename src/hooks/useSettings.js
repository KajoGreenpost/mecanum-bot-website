import { useState, useCallback } from 'react'
import { vehicleApi } from '../api/vehicleApi.js'

export function useSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return vehicleApi.getSettings()
      .then(data => {
        setSettings(data)
        setLoading(false)
        return data
      })
      .catch(err => {
        setLoading(false)
        throw err
      })
  }, [])

  const save = useCallback((data) => {
    setSaving(true)
    return vehicleApi.saveSettings(data)
      .then(() => {
        setSettings(data)
        setSaving(false)
      })
      .catch(err => {
        setSaving(false)
        throw err
      })
  }, [])

  const resetSimulation = useCallback(() => {
    if (vehicleApi.sim.resetSettings) {
      vehicleApi.sim.resetSettings()
    }
  }, [])

  return { settings, loading, saving, load, save, resetSimulation }
}
