/**
 * Environment detection module.
 *
 * Determines whether the app is running on the real ESP32 or in
 * development / Bolt Preview / simulation.
 *
 * REAL ESP MODE takes priority: if hostname matches an ESP host,
 * it is ALWAYS real mode — never falls back to simulation on API failure.
 */

const ESP_HOSTS = [
  '192.168.4.1',
]

const DEV_HOST_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '.bolt.host',
  '.webcontainer.io',
  '.stackblitz.io',
]

function hostnameMatchesDev(hostname) {
  const h = hostname.toLowerCase()
  for (const p of DEV_HOST_PATTERNS) {
    if (h === p || h.endsWith(p)) return true
  }
  return false
}

function hostnameMatchesEsp(hostname) {
  const h = hostname.toLowerCase()
  return ESP_HOSTS.some(e => h === e.toLowerCase())
}

const _hostname = typeof window !== 'undefined' && window.location
  ? window.location.hostname
  : ''

const _isDev = !!(import.meta && import.meta.env && import.meta.env.DEV === true)

export const isEspMode = hostnameMatchesEsp(_hostname)

export const isDevHost = hostnameMatchesDev(_hostname)

/**
 * Simulation mode is active when NOT on a real ESP host.
 * ESP host ALWAYS wins → real mode, regardless of API failures.
 * All other hosts (dev, preview, unknown) → simulation.
 */
export const isSimulation = !isEspMode

export const environment = isEspMode ? 'esp32' : 'simulation'

export const environmentLabel = isEspMode ? 'ESP32 LIVE' : 'SIMULATION'
