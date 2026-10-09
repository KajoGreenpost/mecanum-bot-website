import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, Trash2 } from 'lucide-react'
import { vehicleApi } from '../api/vehicleApi.js'
import Toggle from './Toggle.jsx'

export default function DiagnosticsPage({ isSimulation }) {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState([])
  const [reload, setReload] = useState(0)
  const cursor = useRef(0)
  const boot = useRef(null)
  const terminal = useRef(null)
  const follow = useRef(true)
  const toggleRequest = useRef(null)

  const accept = useCallback(data => {
    const restarted = boot.current !== null && boot.current !== data.bootId
    const newSession = boot.current !== data.bootId
    if (newSession) cursor.current = 0
    boot.current = data.bootId
    const incoming = data.lines.filter(line => line.id > cursor.current)
    cursor.current = data.next
    setLines(prev => [
      ...(restarted ? [{ text: '— ESP32 neu gestartet —' }] : prev),
      ...(data.dropped ? [{ text: `— ${data.dropped} ältere Zeilen überschrieben —` }] : []),
      ...incoming,
    ].slice(-240))
    setEnabled(data.enabled)
    setError('')
    setReady(true)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    vehicleApi.getDebug(0, controller.signal).then(data => {
      if (!controller.signal.aborted) accept(data)
    }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
    return () => { controller.abort(); toggleRequest.current?.abort() }
  }, [accept, reload])

  useEffect(() => {
    if (!enabled || busy) return
    const controller = new AbortController()
    let timer
    const poll = async () => {
      if (document.visibilityState !== 'hidden') {
        try {
          const data = await vehicleApi.getDebug(cursor.current, controller.signal)
          if (!controller.signal.aborted) accept(data)
        } catch (err) {
          if (!controller.signal.aborted) setError(err.message)
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000)
    }
    timer = setTimeout(poll, 1000)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [enabled, busy, accept])

  useEffect(() => {
    if (follow.current && terminal.current) terminal.current.scrollTop = terminal.current.scrollHeight
  }, [lines])

  const changeDebug = async value => {
    if (busy) return
    const controller = new AbortController()
    toggleRequest.current = controller
    setBusy(true)
    try {
      const data = await vehicleApi.setDebugEnabled(value, controller.signal, cursor.current)
      if (!controller.signal.aborted) accept(data)
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <section className="diagnostics-page">
    <div className="diagnostics-header">
      <div className="diagnostics-heading"><Terminal size={20} /><h2>DIAGNOSE</h2>
        <span className={`debug-status ${enabled ? 'active' : ''}`}>{enabled ? 'DEBUG AN' : 'DEBUG AUS'}</span>
      </div>
      <div className="diagnostics-actions">
        <label className="debug-toggle-label"><span>Debugging</span>
          <Toggle checked={enabled} onChange={changeDebug} disabled={!ready || busy} label="Debugging aktivieren" />
        </label>
        <button className="terminal-clear" onClick={() => { setLines([]); follow.current = true }} aria-label="Terminal leeren"><Trash2 size={16} /></button>
      </div>
    </div>
    <p className="diagnostics-note">{isSimulation ? 'SIMULATION: Beispieldaten, keine echten ESP32-Meldungen.' : 'ESP32: Steuerbefehle, Motor-PWM, Einstellungen, Speicher und Sicherheitsstopps.'} Ohne Diagnose-Leser endet Debugging nach 10 Sekunden.</p>
    {error && <div className="diagnostics-error" role="alert">{error}
      {!ready && <button className="btn-secondary" onClick={() => { setError(''); setReload(value => value + 1) }}>ERNEUT LADEN</button>}
    </div>}
    <div className="debug-terminal" ref={terminal} role="log" aria-label="Debug-Terminal" aria-live="off"
      onScroll={event => { const node = event.currentTarget; follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32 }}>
      {lines.length ? lines.map((line, index) => <div className="debug-line" key={index}>
        <span className="debug-timestamp">{line.ms !== undefined ? `[${(line.ms / 1000).toFixed(3)}]` : '[INFO]'}</span> {line.text}
      </div>) : <span className="terminal-placeholder">{enabled ? 'Warte auf Debug-Ausgabe…' : 'Debugging einschalten, um die Ausgabe zu sehen.'}</span>}
    </div>
  </section>
}
