/**
 * Real ESP32 API adapter.
 * All methods return Promises. Uses relative URLs only.
 */

const CONTROL_TIMEOUT = 1200
const SETTINGS_TIMEOUT = 2000

function xhrPost(url, body, timeout) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.timeout = timeout
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText)
      else reject(new Error('HTTP ' + xhr.status))
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.ontimeout = () => reject(new Error('Timeout'))
    xhr.send(body)
  })
}

function xhrGet(url, timeout) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.timeout = timeout
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText)
      else reject(new Error('HTTP ' + xhr.status))
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.ontimeout = () => reject(new Error('Timeout'))
    xhr.send()
  })
}

export const realEspApi = {
  mode: 'esp32',

  /**
   * Send a control frame. Returns { ok, latency } or throws on error.
   * Does NOT queue — caller should skip if a request is in-flight.
   */
  sendControl(frame) {
    const body =
      `s1_dir=${frame.s1_dir}&s1_str=${frame.s1_str}` +
      `&s2_dir=${frame.s2_dir}&s2_str=${frame.s2_str}&en=${frame.en}`
    const t0 = performance.now()
    return xhrPost('/api/control', body, CONTROL_TIMEOUT).then(() => ({
      ok: true,
      latency: Math.round(performance.now() - t0),
    }))
  },

  /** Synchronous best-effort disarm for page unload. */
  sendControlSync(frame) {
    const body =
      `s1_dir=${frame.s1_dir}&s1_str=${frame.s1_str}` +
      `&s2_dir=${frame.s2_dir}&s2_str=${frame.s2_str}&en=${frame.en}`
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/control', false)
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
      xhr.send(body)
    } catch (e) { /* ignore */ }
  },

  getSettings() {
    return xhrGet('/api/settings', SETTINGS_TIMEOUT).then(text => JSON.parse(text))
  },

  saveSettings(data) {
    const body = Object.keys(data)
      .filter(k => data[k] !== undefined && data[k] !== null)
      .map(k => `${k}=${encodeURIComponent(data[k])}`)
      .join('&')
    return xhrPost('/api/settings', body, SETTINGS_TIMEOUT).then(() => {})
  },

  get maintenanceUrl() {
    return '/maintenance'
  },
}
