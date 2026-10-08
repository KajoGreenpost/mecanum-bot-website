/**
 * Common vehicle API abstraction.
 * Automatically selects between real ESP32 and simulation mode
 * based on environment detection.
 *
 * Components should ONLY use vehicleApi — never realEspApi or simulationApi directly.
 */

import { isEspMode, isSimulation, environment, environmentLabel } from './env.js'
import { realEspApi } from './realEspApi.js'
import { simulationApi } from './simulationApi.js'

const _impl = isEspMode ? realEspApi : simulationApi

export const vehicleApi = {
  /** 'esp32' or 'simulation' */
  get mode() { return _impl.mode },

  /** true if running in simulation */
  get isSimulation() { return !isEspMode },

  /** 'ESP32 LIVE' or 'SIMULATION' */
  get environmentLabel() { return environmentLabel },

  /** Current environment from env.js */
  environment,

  /**
   * Send a control frame.
   * frame = { s1_dir, s1_str, s2_dir, s2_str, en }
   * Returns Promise<{ ok, latency }>.
   */
  sendControl(frame) {
    return _impl.sendControl(frame)
  },

  /** Best-effort stop for page unload (non-blocking on ESP32). */
  sendControlSync(frame) {
    _impl.sendControlSync(frame)
  },

  /** GET /api/settings → returns settings object */
  getSettings() {
    return _impl.getSettings()
  },

  /** POST /api/settings → saves settings */
  saveSettings(data) {
    return _impl.saveSettings(data)
  },

  /** Returns maintenance URL or null if simulation */
  get maintenanceUrl() {
    return _impl.maintenanceUrl
  },

  /**
   * Simulation-only helpers. These are safe to call in real mode
   * but will be no-ops / return defaults.
   */
  sim: {
    get isAvailable() { return _impl.mode === 'simulation' },
    get lastFrame() {
      return _impl.mode === 'simulation' ? _impl.lastFrame : { s1_dir: 0, s1_str: 0, s2_dir: 0, s2_str: 0, en: 0 }
    },
    isSimConnected() {
      return _impl.mode === 'simulation' ? _impl.isSimConnected() : true
    },
    setSimConnected(connected) {
      if (_impl.mode === 'simulation') _impl.setSimConnected(connected)
    },
    onConnectionChange(cb) {
      if (_impl.mode === 'simulation' && _impl.onConnectionChange) _impl.onConnectionChange(cb)
    },
    resetSettings() {
      if (_impl.resetSettings) _impl.resetSettings()
    },
  },
}
