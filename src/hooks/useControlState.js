import { useRef, useEffect, useState, useCallback } from 'react'
import { vehicleApi } from '../api/vehicleApi.js'

const HEARTBEAT_MS = 50
const IDLE_HEARTBEAT_MS = 1000

/**
 * Manages the control heartbeat, connection state, arming, and safety.
 * Uses vehicleApi abstraction — works in both real ESP32 and simulation mode.
 * Sends every 50ms while armed, once per second while safe.
 * Skips if a request is in-flight (no queue buildup).
 */
export function useControlState() {
  const [armed, setArmed] = useState(false)
  const [connState, setConnState] = useState(
    vehicleApi.isSimulation ? 'online' : 'connecting'
  )
  const [latency, setLatency] = useState(0)
  const [lastFrame, setLastFrame] = useState({ s1_dir: 0, s1_str: 0, s2_dir: 0, s2_str: 0, en: 0 })

  const armedRef = useRef(false)
  const stick1Ref = useRef({ dir: 0, str: 0 })
  const stick2Ref = useRef({ dir: 0, str: 0 })
  const requestInFlight = useRef(false)
  const connStateRef = useRef(connState)
  const lastSendAt = useRef(-Infinity)
  const lastTelemetryAt = useRef(-Infinity)

  const updateConnection = useCallback((state) => {
    connStateRef.current = state
    setConnState(state)
  }, [])

  const disarmNow = useCallback(() => {
    const wasArmed = armedRef.current
    armedRef.current = false
    setArmed(false)
    stick1Ref.current = { dir: 0, str: 0 }
    stick2Ref.current = { dir: 0, str: 0 }
    lastSendAt.current = -Infinity
    if (wasArmed) vehicleApi.sendControlSync({
      s1_dir: 0, s1_str: 0, s2_dir: 0, s2_str: 0, en: 0,
    })
  }, [])

  // Rotating a phone out of the supported driving orientation stops the vehicle.
  useEffect(() => {
    const portrait = window.matchMedia?.('(orientation: portrait) and (max-width: 600px)')
    const handleRotation = event => { if (event.matches || portrait?.matches) disarmNow() }
    portrait?.addEventListener('change', handleRotation)
    return () => portrait?.removeEventListener('change', handleRotation)
  }, [disarmNow])

  // Simulation: listen for simulated connection changes
  useEffect(() => {
    if (!vehicleApi.isSimulation) return
    vehicleApi.sim.onConnectionChange((connected) => {
      if (connected) {
        updateConnection('online')
      } else {
        updateConnection('lost')
        disarmNow()
      }
    })
    return () => vehicleApi.sim.onConnectionChange(null)
  }, [updateConnection, disarmNow])

  // Build current frame from refs
  const buildFrame = useCallback(() => ({
    s1_dir: stick1Ref.current.dir,
    s1_str: stick1Ref.current.str,
    s2_dir: stick2Ref.current.dir,
    s2_str: stick2Ref.current.str,
    en: armedRef.current ? 1 : 0,
  }), [])

  // Main heartbeat — every 50ms
  useEffect(() => {
    let active = true
    const sendFrame = () => {
      if (document.visibilityState === 'hidden') return
      if (requestInFlight.current) return // skip, no queue
      const now = performance.now()
      const interval = armedRef.current ? HEARTBEAT_MS : IDLE_HEARTBEAT_MS
      if (now - lastSendAt.current < interval) return
      lastSendAt.current = now
      const frame = buildFrame()
      setLastFrame(prev => Object.keys(frame).every(key => prev[key] === frame[key]) ? prev : frame)

      requestInFlight.current = true
      vehicleApi.sendControl(frame)
        .then((res) => {
          requestInFlight.current = false
          if (!active) return
          if (res && typeof res.latency === 'number' && performance.now() - lastTelemetryAt.current >= 250) {
            lastTelemetryAt.current = performance.now()
            setLatency(res.latency)
          }
          if (connStateRef.current !== 'online') updateConnection('online')
        })
        .catch(() => {
          requestInFlight.current = false
          if (!active) return
          disarmNow()
          updateConnection('lost')
        })
    }

    const timer = setInterval(sendFrame, HEARTBEAT_MS)
    const resume = () => {
      if (document.visibilityState !== 'hidden') {
        lastSendAt.current = -Infinity
        sendFrame()
      }
    }
    document.addEventListener('visibilitychange', resume)
    sendFrame()
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [buildFrame, disarmNow, updateConnection])

  // Safety: visibility / unload
  useEffect(() => {
    const disarmAndSend = disarmNow
    const handleHide = () => {
      if (document.visibilityState === 'hidden') disarmAndSend()
    }
    const handleUnload = () => disarmAndSend()

    document.addEventListener('visibilitychange', handleHide)
    window.addEventListener('pagehide', handleUnload)
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleHide)
      window.removeEventListener('pagehide', handleUnload)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [disarmNow])

  const updateStick = useCallback((stick, dir, str) => {
    if (stick === 1) stick1Ref.current = { dir, str }
    else stick2Ref.current = { dir, str }
  }, [])

  const toggleArm = useCallback(() => {
    if (armedRef.current) return disarmNow()
    if (connStateRef.current !== 'online' || document.visibilityState === 'hidden') return
    if (window.matchMedia?.('(orientation: portrait) and (max-width: 600px)').matches) return
    armedRef.current = true
    setArmed(true)
    lastSendAt.current = -Infinity
  }, [disarmNow])

  const reconnect = useCallback(() => {
    if (vehicleApi.isSimulation) {
      vehicleApi.sim.setSimConnected(true)
      updateConnection('online')
      return
    }
    updateConnection('connecting')
    lastSendAt.current = -Infinity
  }, [updateConnection])

  // Simulation-only: force connection loss
  const simulateConnectionLoss = useCallback(() => {
    if (vehicleApi.isSimulation) {
      vehicleApi.sim.setSimConnected(false)
    }
  }, [])

  // Simulation-only: restore connection
  const restoreConnection = useCallback(() => {
    if (vehicleApi.isSimulation) {
      vehicleApi.sim.setSimConnected(true)
    }
  }, [])

  return {
    armed, toggleArm, disarmNow,
    connState, reconnect,
    latency, lastFrame,
    isSimulation: vehicleApi.isSimulation,
    environmentLabel: vehicleApi.environmentLabel,
    updateStick,
    simulateConnectionLoss, restoreConnection,
  }
}
