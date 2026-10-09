import { useCallback, useEffect, useRef, useState } from 'react'
import { vehicleApi } from '../api/vehicleApi.js'

export function useCalibration() {
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const state = useRef({ generation: 0, session: 0, frame: null, pending: false, since: 0 })
  const mounted = useRef(true)

  const stop = useCallback(() => {
    const current = state.current
    current.generation++
    current.frame = null
    current.session = 0
    vehicleApi.stopCalibrationSync()
    if (mounted.current) setRunning(false)
  }, [])

  const send = useCallback(async () => {
    const current = state.current
    if (!current.frame || !current.session || current.pending) return
    current.pending = true
    const generation = current.generation
    try {
      const result = await vehicleApi.calibration({ action: 'drive', session: current.session, sequence: 1, ...current.frame })
      if (generation !== current.generation || !mounted.current) return
      if (!result.active) throw new Error('Kalibrierung wurde vom Fahrzeug beendet.')
      if (result.done) stop()
    } catch (err) {
      if (generation === current.generation && mounted.current) { stop(); setError(err.message) }
    } finally {
      current.pending = false
      if (mounted.current) setBusy(false)
    }
  }, [stop])

  const start = useCallback(async frame => {
    const current = state.current
    if (current.pending || current.frame || document.visibilityState === 'hidden') return
    current.frame = frame
    current.since = performance.now()
    const generation = ++current.generation
    current.pending = true
    setBusy(true)
    setRunning(true)
    setError('')
    try {
      const result = await vehicleApi.calibration({ action: 'start' })
      if (generation !== current.generation || !mounted.current) { vehicleApi.stopCalibrationSync(); return }
      if (!result.active || !result.session) throw new Error('Kalibrierung konnte nicht gestartet werden.')
      current.session = result.session
      current.pending = false
      await send()
    } catch (err) {
      if (generation === current.generation && mounted.current) { stop(); setError(err.message) }
    } finally {
      current.pending = false
      if (mounted.current) setBusy(false)
    }
  }, [send, stop])

  const setPower = useCallback(pwm => {
    if (state.current.frame) state.current.frame = { ...state.current.frame, pwm }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer = setInterval(() => {
      if (state.current.frame && performance.now() - state.current.since >= 15000) {
        stop(); setError('Test nach 15 Sekunden beendet. Zum Fortsetzen den Regler erneut anfassen.')
      } else send()
    }, 50)
    const hide = () => { if (document.visibilityState === 'hidden') stop() }
    const portrait = window.matchMedia?.('(orientation: portrait) and (max-width: 600px)')
    const rotate = event => { if (event.matches) stop() }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', stop)
    portrait?.addEventListener('change', rotate)
    return () => {
      mounted.current = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', stop)
      portrait?.removeEventListener('change', rotate)
      stop()
    }
  }, [send, stop])

  return { running, busy, error, start, stop, setPower }
}
