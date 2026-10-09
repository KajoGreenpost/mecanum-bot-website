/**
 * Simulation API adapter.
 * Frontend-only — no HTTP requests. Simulates ESP32 responses locally.
 * Settings persist to localStorage.
 */

const STORAGE_KEY = 'rc_mecanum_sim_settings'

const DEFAULT_SETTINGS = {
  schema: 1,
  speedMode: 0,
  startMin: 18,
  boost: 82,
  boostTime: 40,
  deadzone: 8,
  invertFL: 0, invertFR: 0, invertRL: 0, invertRR: 0,
  invertMoveY: 0, invertMoveX: 0, invertTurn: 0,
}

// In-memory simulated connection state
let _simConnected = true
let _lastFrame = { s1_dir: 0, s1_str: 0, s2_dir: 0, s2_str: 0, en: 0 }
let _onConnChange = null
let _debugEnabled = false
let _debugSeq = 0
let _debugLines = []
let _debugLastState = 0
let _debugLastRead = 0
const _debugStart = Date.now()

function simDebugLog(text) {
  _debugLines.push({ id: ++_debugSeq, ms: Date.now() - _debugStart, text })
  _debugLines = _debugLines.slice(-32)
}

function loadSettingsStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettingsStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) { /* ignore */ }
}

function randomLatency() {
  return 8 + Math.floor(Math.random() * 18) // 8–25 ms
}

export const simulationApi = {
  mode: 'simulation',

  sendControl(frame) {
    _lastFrame = { ...frame }
    if (!_simConnected) {
      return Promise.reject(new Error('Simulated connection lost'))
    }
    return new Promise(resolve => {
      setTimeout(() => resolve({ ok: true, latency: randomLatency() }), 2)
    })
  },

  sendControlSync(frame) {
    _lastFrame = { ...frame }
    // no-op in simulation
  },

  getSettings() {
    return new Promise(resolve => {
      setTimeout(() => resolve(loadSettingsStore()), 10)
    })
  },

  saveSettings(data) {
    const merged = { ...loadSettingsStore(), ...data }
    saveSettingsStore(merged)
    if (_debugEnabled) simDebugLog('SIMULATION: SETTINGS saved')
    return new Promise(resolve => setTimeout(resolve, 15))
  },

  getDebug(after = 0) {
    if (!_simConnected) return Promise.reject(new Error('Simulation: Verbindung unterbrochen.'))
    const now = Date.now()
    if (_debugEnabled && now - _debugLastRead > 10000) _debugEnabled = false
    if (_debugEnabled && now - _debugLastState >= 1000) {
      _debugLastState = now
      simDebugLog(`SIMULATION: STATE en=${_lastFrame.en} stick1=${_lastFrame.s1_dir}/${_lastFrame.s1_str} stick2=${_lastFrame.s2_dir}/${_lastFrame.s2_str}`)
    }
    _debugLastRead = now
    const lines = _debugLines.filter(line => line.id > after).slice(0, 8)
    return Promise.resolve({ enabled: _debugEnabled, bootId: 1, dropped: Math.max(0, (_debugLines[0]?.id || 1) - after - 1), lines, next: lines.at(-1)?.id ?? after })
  },

  setDebugEnabled(enabled, signal, after = 0) {
    if (!_simConnected) return Promise.reject(new Error('Simulation: Verbindung unterbrochen.'))
    if (enabled !== _debugEnabled) simDebugLog(enabled ? 'SIMULATION: DEBUG enabled (keine echten ESP32-Daten)' : 'SIMULATION: DEBUG disabled')
    _debugEnabled = enabled
    _debugLastRead = Date.now()
    return this.getDebug(after)
  },

  get maintenanceUrl() {
    return null // signal that maintenance is simulated
  },

  // --- Simulation-specific helpers ---
  get lastFrame() { return { ..._lastFrame } },

  isSimConnected() { return _simConnected },

  setSimConnected(connected) {
    _simConnected = connected
    if (_onConnChange) _onConnChange(connected)
  },

  onConnectionChange(cb) {
    _onConnChange = cb
  },

  resetSettings() {
    try { localStorage.removeItem(STORAGE_KEY) } catch (e) { /* ignore */ }
  },
}
