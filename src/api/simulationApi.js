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
  idleTimeoutSeconds: 10,
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
let _calibration = null
let _calibrationSession = 0

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
    _calibration = null
    _lastFrame = { ...frame }
    if (!_simConnected) {
      return Promise.reject(new Error('Simulated connection lost'))
    }
    return new Promise(resolve => {
      setTimeout(() => resolve({ ok: true, latency: randomLatency() }), 2)
    })
  },

  sendControlSync(frame) {
    _calibration = null
    _lastFrame = { ...frame }
    // no-op in simulation
  },

  getSettings() {
    return new Promise(resolve => {
      setTimeout(() => resolve(loadSettingsStore()), 10)
    })
  },

  calibration(data) {
    if (!_simConnected) return Promise.reject(new Error('Simulation: Verbindung unterbrochen.'))
    const now = Date.now()
    if (_calibration && now - _calibration.last > 300) _calibration = null
    if (data.action === 'stop') { _calibration = null; return Promise.resolve({ active: false, done: true }) }
    if (data.action === 'start') {
      if (_calibration) return Promise.reject(new Error('Kalibrierung bereits aktiv.'))
      _calibration = { session: ++_calibrationSession, last: now, since: null, frame: null }
    } else if (data.action === 'drive') {
      if (!_calibration || Number(data.session) !== _calibration.session) return Promise.reject(new Error('Kalibrierung abgelaufen.'))
      _calibration.last = now
      if (_calibration.since === null) _calibration.since = now
      _calibration.frame = { ...data }
    }
    const duration = _calibration?.frame?.mode === 'pulse' ? Number(_calibration.frame.boostMs) + 600 : 15000
    return Promise.resolve({ active: !!_calibration, session: _calibration?.session,
      done: _calibration?.since !== null && now - _calibration?.since >= duration })
  },
  stopCalibrationSync() { _calibration = null },

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
