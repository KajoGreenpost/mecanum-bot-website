import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import SettingsPage from '../src/components/SettingsPage.jsx'
import { useSettings } from '../src/hooks/useSettings.js'
import { useControlState } from '../src/hooks/useControlState.js'
import { vehicleApi } from '../src/api/vehicleApi.js'
import { realEspApi } from '../src/api/realEspApi.js'
import DiagnosticsPage from '../src/components/DiagnosticsPage.jsx'

const defaults = { speedMode: 0, startMin: 18, boost: 82, boostTime: 40, deadzone: 8 }
const flush = () => Promise.resolve()

test('diagnostics only polls while enabled, preserves cursor, caps output and stops after disabling', async () => {
  const original = { get: vehicleApi.getDebug, set: vehicleApi.setDebugEnabled, document: globalThis.document,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout }
  const timers = new Map()
  let timerId = 0, renderer, reads = 0, after = 0
  globalThis.document = { visibilityState: 'visible' }
  globalThis.setTimeout = (fn, ms) => { assert.equal(ms, 1000); timers.set(++timerId, fn); return timerId }
  globalThis.clearTimeout = id => timers.delete(id)
  vehicleApi.getDebug = async cursor => {
    reads++; after = cursor
    return reads === 1 ? { enabled: false, bootId: 1, lines: [], next: 0 } : {
      enabled: true, bootId: 1, next: 301,
      lines: Array.from({ length: 300 }, (_, i) => ({ id: i + 2, ms: i, text: `STATE ${i}` })),
    }
  }
  vehicleApi.setDebugEnabled = async (enabled, signal, cursor) => ({ enabled, bootId: 1,
    lines: [{ id: cursor + 1, ms: 0, text: enabled ? 'DEBUG enabled' : 'DEBUG disabled' }], next: cursor + 1 })
  try {
    await act(async () => { renderer = create(<DiagnosticsPage isSimulation={false} />); await flush() })
    assert.equal(reads, 1)
    assert.equal(timers.size, 0, 'disabled debugging must not poll')
    await act(async () => { renderer.root.findByProps({ role: 'switch' }).props.onClick(); await flush() })
    assert.equal(renderer.root.findByProps({ role: 'switch' }).props['aria-checked'], true)
    const poll = [...timers.values()][0]; timers.clear()
    await act(async () => { await poll() })
    assert.equal(after, 1)
    assert.equal(renderer.root.findAllByProps({ className: 'debug-line' }).length, 240)
    await act(async () => { renderer.root.findByProps({ role: 'switch' }).props.onClick(); await flush() })
    assert.equal(renderer.root.findByProps({ role: 'switch' }).props['aria-checked'], false)
    assert.equal(timers.size, 0)
    act(() => renderer.root.findByProps({ 'aria-label': 'Terminal leeren' }).props.onClick())
    assert.equal(renderer.root.findAllByProps({ className: 'debug-line' }).length, 0)
  } finally {
    act(() => renderer?.unmount())
    vehicleApi.getDebug = original.get; vehicleApi.setDebugEnabled = original.set
    globalThis.document = original.document; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout
  }
})

test('diagnostics clearly reports old firmware and keeps switch disabled', async () => {
  const original = vehicleApi.getDebug
  let renderer
  vehicleApi.getDebug = async () => { throw new Error('Firmware-Update für Diagnose erforderlich.') }
  try {
    await act(async () => { renderer = create(<DiagnosticsPage isSimulation={false} />); await flush() })
    assert.equal(renderer.root.findByProps({ role: 'switch' }).props.disabled, true)
    assert.match(renderer.root.findByProps({ role: 'alert' }).children.join(''), /Firmware-Update/)
  } finally { act(() => renderer?.unmount()); vehicleApi.getDebug = original }
})

test('debug API sends incremental cursor and reports HTTP failures', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ enabled: true, bootId: 1, lines: [], next: 42 }), { status: 200 })
  }
  try {
    await realEspApi.getDebug(42)
    await realEspApi.setDebugEnabled(true, undefined, 42)
    assert.equal(calls[0].url, '/api/debug?after=42')
    assert.equal(calls[1].url, '/api/debug?after=42')
    assert.equal(calls[1].options.body, 'enabled=1')
    globalThis.fetch = async () => new Response('', { status: 404 })
    await assert.rejects(realEspApi.getDebug(), /Firmware-Update/)
  } finally { globalThis.fetch = original }
})

test('settings load once across heartbeat rerenders and preserve unsaved edits', async () => {
  const original = vehicleApi.getSettings
  let loads = 0
  vehicleApi.getSettings = async () => { loads++; return defaults }
  let renderer
  const showToast = () => {}
  function Parent({ tick }) {
    const settings = useSettings()
    return <SettingsPage settings={settings} showToast={showToast} isSimulation={false} />
  }
  try {
    await act(async () => { renderer = create(<Parent tick={0} />); await flush() })
    assert.equal(loads, 1)
    act(() => renderer.root.findAllByType('input')[0].props.onChange({ target: { value: '65' } }))
    for (let tick = 1; tick <= 40; tick++) {
      await act(async () => { renderer.update(<Parent tick={tick} />); await flush() })
    }
    assert.equal(loads, 1, 'parent updates must not reload the settings')
    assert.equal(renderer.root.findAllByType('input')[0].props.value, 65)
  } finally {
    act(() => renderer?.unmount())
    vehicleApi.getSettings = original
  }
})

test('settings deduplicate requests; successful and failed saves preserve the editable form', async () => {
  const originalGet = vehicleApi.getSettings
  const originalSave = vehicleApi.saveSettings
  let resolveLoad, resolveSave, rejectSave, settings, loads = 0, saves = 0, renderer
  vehicleApi.getSettings = () => { loads++; return new Promise(resolve => { resolveLoad = resolve }) }
  vehicleApi.saveSettings = data => {
    saves++
    return new Promise((resolve, reject) => { resolveSave = () => resolve(data); rejectSave = reject })
  }
  const showToast = () => {}
  function Parent() {
    settings = useSettings()
    return <SettingsPage settings={settings} showToast={showToast} isSimulation={false} />
  }
  try {
    act(() => { renderer = create(<Parent />) })
    let duplicate
    act(() => { duplicate = settings.load() })
    assert.equal(loads, 1)
    await act(async () => { resolveLoad(defaults); await duplicate })
    const edit = value => renderer.root.findAllByType('input')[0].props.onChange({ target: { value: String(value) } })
    const saveButton = () => renderer.root.findAllByType('button').find(button => button.props.disabled !== undefined && button.props.className.includes('btn-primary'))
    act(() => edit(65))
    act(() => { saveButton().props.onClick(); saveButton().props.onClick() })
    assert.equal(saves, 1)
    act(() => edit(70))
    await act(async () => { resolveSave(); await flush() })
    assert.equal(renderer.root.findAllByType('input')[0].props.value, 70)
    act(() => saveButton().props.onClick())
    await act(async () => { rejectSave(new Error('offline')); await flush() })
    assert.equal(renderer.root.findAllByType('input')[0].props.value, 70)
    assert.equal(loads, 1)
    assert.equal(settings.saving, false)
  } finally {
    act(() => renderer?.unmount())
    vehicleApi.getSettings = originalGet
    vehicleApi.saveSettings = originalSave
  }
})

test('heartbeat uses 1 Hz idle, 20 Hz armed, no request queue, and disarms on loss/hide', async () => {
  const originals = { document: globalThis.document, window: globalThis.window,
    performance: globalThis.performance, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
    send: vehicleApi.sendControl, stop: vehicleApi.sendControlSync }
  let now = 0, tick, control, renderer, pending, failure, stops = 0
  const frames = []
  const listeners = new Map()
  globalThis.document = { visibilityState: 'visible',
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn) },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn) } }
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.performance = { now: () => now }
  globalThis.setInterval = fn => { tick = fn; return 1 }
  globalThis.clearInterval = () => {}
  vehicleApi.sendControl = frame => {
    frames.push(frame)
    return new Promise((resolve, reject) => { pending = () => resolve({ ok: true, latency: 10 }); failure = reject })
  }
  vehicleApi.sendControlSync = frame => { assert.equal(frame.en, 0); stops++ }
  function Harness() { control = useControlState(); return null }
  const step = async (time, resolve = true) => {
    now = time
    await act(async () => { tick(); if (resolve) pending(); await flush() })
  }
  try {
    act(() => { renderer = create(<Harness />) })
    await act(async () => { pending(); await flush() })
    for (let time = 50; time <= 1000; time += 50) await step(time)
    assert.equal(frames.length, 2)
    act(() => { control.updateStick(1, 1, 80, true) })
    await step(1050)
    await step(1100)
    assert.equal(frames.at(-1).en, 1)
    assert.equal(frames.at(-1).s1_str, 80)
    await step(1150, false)
    const count = frames.length
    await step(1200, false)
    assert.equal(frames.length, count, 'only one request in flight')
    await act(async () => { failure(new Error('Timeout')); await flush() })
    assert.equal(control.armed, false)
    assert.equal(control.connState, 'lost')
    await step(1250)
    assert.equal(frames.at(-1).en, 0)
    assert.equal(frames.at(-1).s1_str, 0)
    assert.equal(control.connState, 'online')
    act(() => control.updateStick(1, 1, 80, true))
    assert.equal(control.armed, false, 'a held gesture must not restart after connection recovery')
    assert.equal(control.releaseRequired, true)
    act(() => {
      control.updateStick(1, 0, 0, false)
      control.updateStick(1, 1, 80, true)
    })
    act(() => {
      document.visibilityState = 'hidden'
      listeners.get('visibilitychange').forEach(fn => fn())
    })
    assert.equal(control.armed, false)
    assert.equal(stops, 2)
    const beforeHide = frames.length
    await step(2000, false)
    assert.equal(frames.length, beforeHide)
    await act(async () => {
      document.visibilityState = 'visible'
      listeners.get('visibilitychange').forEach(fn => fn())
      pending(); await flush()
    })
    assert.equal(frames.at(-1).en, 0)
  } finally {
    act(() => renderer?.unmount())
    vehicleApi.sendControl = originals.send
    vehicleApi.sendControlSync = originals.stop
    for (const key of ['document', 'window', 'performance', 'setInterval', 'clearInterval']) globalThis[key] = originals[key]
  }
})

test('automatic activation: last release stops; manual stop needs a fresh gesture', async () => {
  const original = { document: globalThis.document, window: globalThis.window,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
    send: vehicleApi.sendControl, stop: vehicleApi.sendControlSync }
  let control, renderer, stops = 0
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.setInterval = () => 1
  globalThis.clearInterval = () => {}
  vehicleApi.sendControl = async () => ({ ok: true, latency: 10 })
  vehicleApi.sendControlSync = frame => { assert.equal(frame.en, 0); stops++ }
  function Harness() { control = useControlState(); return null }
  try {
    await act(async () => { renderer = create(<Harness />); await flush() })
    act(() => control.updateStick(1, 0, 0, true))
    assert.equal(control.armed, false, 'touching the deadzone must not activate motors')
    act(() => control.updateStick(1, 1, 60, true))
    assert.equal(control.armed, true)
    act(() => control.updateStick(2, 3, 60, true))
    act(() => control.updateStick(1, 0, 0, false))
    assert.equal(control.armed, true, 'the other thumb must keep working')
    act(() => control.updateStick(2, 0, 0, false))
    assert.equal(control.armed, false)
    assert.equal(control.releaseRequired, false)
    act(() => control.updateStick(1, 1, 60, true))
    assert.equal(control.armed, true, 'next gesture automatically reactivates')
    act(() => control.disarmNow())
    act(() => control.updateStick(1, 1, 75, true))
    assert.equal(control.armed, false, 'stop button must not be undone by the held thumb')
    assert.equal(control.releaseRequired, true)
    act(() => control.updateStick(1, 0, 0, false))
    assert.equal(control.releaseRequired, false)
    act(() => control.updateStick(1, 1, 60, true))
    assert.equal(control.armed, true)
    assert.equal(stops, 2)
  } finally {
    act(() => renderer?.unmount())
    vehicleApi.sendControl = original.send; vehicleApi.sendControlSync = original.stop
    for (const key of ['document', 'window', 'setInterval', 'clearInterval']) globalThis[key] = original[key]
  }
})

test('real API sends complete frames, bounds armed timeout, and parses saved settings', async () => {
  const original = globalThis.XMLHttpRequest
  const requests = []
  globalThis.XMLHttpRequest = class {
    constructor() { requests.push(this) }
    open(method, url, async) { Object.assign(this, { method, url, async }) }
    setRequestHeader() {}
    send(body) {
      this.body = body
      this.status = 200
      this.responseText = this.url === '/api/settings' ? JSON.stringify({ ...defaults, startMin: 65 }) : '{"status":"ok"}'
      this.onload()
    }
  }
  try {
    await realEspApi.sendControl({ s1_dir: 1, s1_str: 80, s2_dir: 0, s2_str: 0, en: 1 })
    assert.equal(requests[0].timeout, 250)
    assert.equal(requests[0].body, 's1_dir=1&s1_str=80&s2_dir=0&s2_str=0&en=1')
    const saved = await realEspApi.saveSettings({ startMin: 65 })
    assert.equal(saved.startMin, 65)
    assert.equal(requests[1].body, 'startMin=65')
  } finally { globalThis.XMLHttpRequest = original }
})
