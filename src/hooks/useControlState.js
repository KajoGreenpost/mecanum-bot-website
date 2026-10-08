import { useRef, useEffect, useState, useCallback } from 'react'
import { vehicleApi } from '../api/vehicleApi.js'

const HEARTBEAT_MS = 50

/**
 * Manages the control heartbeat, connection state, arming, and safety.
 * Uses vehicleApi abstraction — works in both real ESP32 and simulation mode.
 * Sends a complete control frame every 50ms.
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

  useEffect(() => { armedRef.current = armed }, [armed])
  useEffect(() => { connStateRef.current = connState }, [connState])

  // Simulation: listen for simulated connection changes
  useEffect(() => {
    if (!vehicleApi.isSimulation) return
    vehicleApi.sim.onConnectionChange((connected) => {
      if (connected) {
        setConnState('online')
      } else {
        setConnState('lost')
        setArmed(false)
        stick1Ref.current = { dir: 0, str: 0 }
        stick2Ref.current = { dir: 0, str: 0 }
      }
    })
  }, [])

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
    const sendFrame = () => {
      const frame = buildFrame()
      setLastFrame(frame)

      if (requestInFlight.current) return // skip, no queue

      requestInFlight.current = true
      vehicleApi.sendControl(frame)
        .then((res) => {
          requestInFlight.current = false
          if (res && typeof res.latency === 'number') setLatency(res.latency)
          if (connStateRef.current !== 'online') setConnState('online')
        })
        .catch(() => {
          requestInFlight.current = false
          if (connStateRef.current === 'online') {
            setConnState('lost')
            setArmed(false)
            stick1Ref.current = { dir: 0, str: 0 }
            stick2Ref.current = { dir: 0, str: 0 }
          }
        })
    }

    const timer = setInterval(sendFrame, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [buildFrame])

  // Safety: visibility / unload
  useEffect(() => {
    const disarmAndSend = () => {
      setArmed(false)
      stick1Ref.current = { dir: 0, str: 0 }
      stick2Ref.current = { dir: 0, str: 0 }
      vehicleApi.sendControlSync({
        s1_dir: 0, s1_str: 0, s2_dir: 0, s2_str: 0, en: 0,
      })
    }
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
  }, [])

  const updateStick = useCallback((stick, dir, str) => {
    if (stick === 1) stick1Ref.current = { dir, str }
    else stick2Ref.current = { dir, str }
  }, [])

  const toggleArm = useCallback(() => {
    setArmed(prev => !prev)
  }, [])

  const disarmNow = useCallback(() => {
    setArmed(false)
    stick1Ref.current = { dir: 0, str: 0 }
    stick2Ref.current = { dir: 0, str: 0 }
  }, [])

  const reconnect = useCallback(() => {
    if (vehicleApi.isSimulation) {
      vehicleApi.sim.setSimConnected(true)
      setConnState('online')
      return
    }
    setConnState('connecting')
    vehicleApi.getSettings()
      .then(() => setConnState('online'))
      .catch(() => setConnState('lost'))
  }, [])

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
    armed, setArmed, toggleArm, disarmNow,
    connState, setConnState, reconnect,
    latency, lastFrame,
    isSimulation: vehicleApi.isSimulation,
    environmentLabel: vehicleApi.environmentLabel,
    updateStick,
    simulateConnectionLoss, restoreConnection,
  }
}
