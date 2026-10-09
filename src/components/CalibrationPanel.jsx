import { useEffect, useRef, useState } from 'react'
import { useCalibration } from '../hooks/useCalibration.js'
import { useJoystick } from '../hooks/useJoystick.js'

const STEPS = ['Anlaufen', 'Weiterlaufen', 'Anfahrdauer', 'Totzone', 'Ergebnis']
const HELP = [
  'Regler anfassen und langsam erhöhen, bis die gewählten Räder zuverlässig anlaufen. Loslassen stoppt sofort und merkt die Leistung.',
  'Regler anfassen: Der gemerkte Boost startet die Räder. Leistung herunterregeln, solange sie gleichmäßig weiterlaufen. Loslassen stoppt und merkt den Wert.',
  'Impulsdauer einstellen und „Anfahren testen“ drücken. Der Boost läuft so lange wie eingestellt, danach folgt 600 ms mit dem gemerkten Start-Minimum.',
  'Motoren bleiben aus. Erst den Daumen locker in der Mitte halten, dann bewusst kleine Bewegungen ausführen und jeweils loslassen.',
  'Prüfe die Werte und speichere sie gemeinsam. Mit normalem Akkustand und Last anschließend auf dem Boden prüfen.',
]

function DeadzoneProbe({ onResult }) {
  const [phase, setPhase] = useState('rest')
  const [rest, setRest] = useState(0)
  const [intent, setIntent] = useState(null)
  const [samples, setSamples] = useState(0)
  const peak = useRef(0)
  const joystick = useJoystick((dir, strength, pressed) => {
    if (phase === 'rest' && pressed) { setRest(value => Math.max(value, strength)); setSamples(value => value + 1) }
    if (phase === 'intent') {
      if (pressed) peak.current = Math.max(peak.current, strength)
      else if (peak.current > 0) { const measured = peak.current; setIntent(value => value === null ? measured : Math.min(value, measured)); peak.current = 0 }
    }
  }, 0)
  const recommended = Math.min(30, rest + 2)
  const valid = samples > 0 && rest < 30 && intent !== null && intent > recommended
  return <div className="cal-probe">
    <div className="cal-touchpad" ref={joystick.elRef} aria-label="Totzone messen"
      onPointerDown={joystick.onPointerDown} onPointerMove={joystick.onPointerMove}
      onPointerUp={joystick.onPointerUp} onPointerCancel={joystick.onPointerCancel}
      onLostPointerCapture={joystick.onLostPointerCapture}>
      <span className="cal-probe-center" />
      <span className="cal-probe-knob" style={{ transform: `translate(${joystick.knobPos.x}px, ${joystick.knobPos.y}px)` }} />
    </div>
    <div>
      <strong>{phase === 'rest' ? '1. Daumen locker in der Mitte halten' : '2. Bewusst kleine Ausschläge, dann loslassen'}</strong>
      <p>Unbeabsichtigt: {rest} % · Bewusst: {intent === null ? '—' : `${intent} %`}</p>
      {phase === 'rest' ? <button className="btn-secondary" disabled={!samples || joystick.active}
        onClick={() => { peak.current = 0; setPhase('intent') }}>ABSICHTLICHE BEWEGUNG MESSEN</button>
        : <button className="btn-primary" disabled={!valid || joystick.active} onClick={() => onResult(recommended)}>VORSCHLAG {recommended} % MERKEN</button>}
      {phase === 'intent' && !valid && <p>Bewegungen müssen klar größer als das Zittern in der Mitte sein. Bei Bedarf neu messen.</p>}
      <button className="btn-secondary" onClick={() => { joystick.reset(); setPhase('rest'); setRest(0); setIntent(null); setSamples(0); peak.current = 0 }}>NEU MESSEN</button>
    </div>
  </div>
}

export default function CalibrationPanel({ settings, isSimulation, onClose, onActive }) {
  const calibration = useCalibration()
  const [step, setStep] = useState(0)
  const [power, setPower] = useState(0)
  const [wheel, setWheel] = useState(0)
  const [reverse, setReverse] = useState(false)
  const [draft, setDraft] = useState(null)
  const [marked, setMarked] = useState({})
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [durationMs, setDurationMs] = useState(120)
  const held = useRef(false)
  const measurements = useRef({})
  const powerRef = useRef(power)
  const { load } = settings

  useEffect(() => {
    onActive(true)
    let active = true
    load().then(data => {
      if (!active) return
      setDraft({ startMin: data.startMin, boost: data.boost, boostTime: data.boostTime, deadzone: data.deadzone })
      setDurationMs(data.boostTime * 3)
    }).catch(error => { if (active) setLoadError(error.message) })
    return () => { active = false; onActive(false) }
  }, [load, onActive])

  const stop = () => { held.current = false; calibration.stop() }
  const switchStep = value => {
    stop(); setMessage(''); setStep(value)
    const nextPower = value === 1 ? Math.max(70, draft?.startMin || 0) : 0
    setPower(nextPower); powerRef.current = nextPower
  }
  const remember = (field, value) => {
    if (field !== 'deadzone') {
      const observations = measurements.current[field] ||= {}
      observations[`${wheel}:${reverse}`] = value
      value = Math.max(...Object.values(observations))
    }
    setDraft(previous => ({ ...previous, [field]: value }))
    setMarked(previous => ({ ...previous, [field]: true }))
    setMessage(`${field === 'boostTime' ? 'Anfahrdauer' : field === 'startMin' ? 'Start-Minimum' : field === 'boost' ? 'Boost' : 'Totzone'} gemerkt: ${field === 'boostTime' ? value * 3 + ' ms' : value + ' %'}`)
  }
  const frame = (mode, pwm) => ({ mode, pwm, wheel, reverse: reverse ? 1 : 0,
    boost: step === 0 ? 0 : draft.boost,
    boostMs: step === 0 ? 0 : step === 2 ? durationMs : draft.boostTime * 3 })
  const begin = event => {
    if (!draft || calibration.busy || calibration.running) return
    held.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setMessage('')
    calibration.start(frame('live', powerRef.current))
  }
  const release = () => {
    if (!held.current) return
    held.current = false
    calibration.stop()
    remember(step === 0 ? 'boost' : 'startMin', powerRef.current)
  }
  const cancel = () => { if (held.current) stop() }
  const save = async () => {
    stop(); setMessage('')
    try {
      const changes = Object.fromEntries(Object.keys(marked).filter(key => marked[key]).map(key => [key, draft[key]]))
      await settings.save(changes)
      setMessage('Kalibrierungswerte gespeichert. Nicht neu gemessene Werte bleiben erhalten.')
    } catch { setMessage('Speichern fehlgeschlagen. Die gemerkten Werte bleiben hier erhalten.') }
  }

  return <section className="calibration-panel" aria-label="Kalibrierungs-Assistent">
    <div className="cal-header"><h2>KALIBRIERUNG<small className={calibration.running ? 'active' : ''}>{calibration.running ? 'TEST AKTIV' : 'MOTOREN AUS'}</small></h2>
      <button className="btn-secondary" onClick={() => { stop(); onClose() }}>SCHLIESSEN</button>
      <button className="cal-stop" onClick={stop}>STOPP</button>
    </div>
    {isSimulation && <p className="cal-simulation">SIMULATION: Bedienablauf ohne Motorbewegung.</p>}
    {loadError && <p role="alert">Einstellungen konnten nicht geladen werden: {loadError}. Assistent schließen und erneut öffnen.</p>}
    {!draft ? <p>Lade aktuelle Werte…</p> : <>
      <nav className="cal-steps" aria-label="Kalibrierungsschritte">{STEPS.map((label, index) =>
        <button key={label} className={step === index ? 'selected' : ''} onClick={() => switchStep(index)}>{index + 1}. {label}</button>)}</nav>
      <div className="cal-body">
        <div className="cal-instructions"><h3>{STEPS[step]}</h3><p>{HELP[step]}</p>
          {step < 3 && <>
            <label>Räder <select aria-label="Räder auswählen" value={wheel} onChange={event => { stop(); setWheel(Number(event.target.value)) }}>
              {['Alle', 'FL', 'FR', 'RL', 'RR'].map((label, index) => <option key={label} value={index}>{label}</option>)}
            </select></label>
            <label>Richtung <select aria-label="Testrichtung" value={reverse ? 1 : 0} onChange={event => { stop(); setReverse(event.target.value === '1') }}>
              <option value="0">Vorwärts</option><option value="1">Rückwärts</option>
            </select></label>
            <details><summary>Testhinweise</summary>
              <p>Für den ersten Test Räder frei drehen lassen. Danach mit normaler Last prüfen. Alle Räder und beide Drehrichtungen vergleichen.</p>
              <p>Direkte Motorleistung. Ein Test endet spätestens nach 15 Sekunden.</p>
              <p>Pro Rad-Auswahl und Richtung zählt der zuletzt gemerkte Test. Für den gemeinsamen Wert wird der höchste dieser Werte verwendet.</p>
            </details>
          </>}
        </div>
        <div className="cal-controls">
          {step < 2 && <>
            <label className="cal-value" htmlFor="cal-power">{power} % <small>{step === 0 ? 'Anfahrleistung' : 'Leistung zum Weiterlaufen'}</small></label>
            <input id="cal-power" className="cal-power" aria-label="Motorleistung" type="range" min="0" max="100" step="1" value={power}
              style={{ '--cal-value': `${power}%` }}
              onPointerDown={begin} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={cancel}
              onChange={event => { const value = Number(event.target.value); powerRef.current = value; setPower(value); calibration.setPower(value) }} />
            <p>Regler halten und bewegen = testen. Loslassen = sofort stoppen und Wert merken.</p>
            <button className="btn-secondary" disabled={calibration.running || calibration.busy} onClick={() => remember(step === 0 ? 'boost' : 'startMin', power)}>WERT MERKEN</button>
          </>}
          {step === 2 && <>
            <label className="cal-value" htmlFor="cal-duration">{durationMs} ms <small>Boost {draft.boost} % → Weiterlaufen {draft.startMin} %</small></label>
            <input id="cal-duration" className="cal-power" aria-label="Anfahrdauer" type="range" min="0" max="300" step="3" value={durationMs}
              style={{ '--cal-value': `${durationMs / 3}%` }}
              disabled={calibration.running || calibration.busy} onChange={event => setDurationMs(Number(event.target.value))} />
            <button className="btn-primary cal-test" disabled={calibration.running || calibration.busy} onClick={() => calibration.start(frame('pulse', draft.startMin))}>ANFAHREN TESTEN</button>
            <button className="btn-secondary" disabled={calibration.running || calibration.busy} onClick={() => remember('boostTime', durationMs / 3)}>DAUER MERKEN</button>
          </>}
          {step === 3 && <DeadzoneProbe onResult={value => remember('deadzone', value)} />}
          {step === 4 && <>
            <dl className="cal-results">{[['boost', 'Boost'], ['startMin', 'Start-Minimum'], ['boostTime', 'Anfahrdauer'], ['deadzone', 'Totzone']].map(([key, label]) =>
              <div key={key}><dt>{label}</dt><dd>{key === 'boostTime' ? draft[key] * 3 + ' ms' : draft[key] + ' %'} <small>{marked[key] ? 'neu gemerkt' : 'bisheriger Wert'}</small></dd></div>)}</dl>
            <button className="btn-primary" disabled={!Object.values(marked).some(Boolean) || settings.saving} onClick={save}>{settings.saving ? 'SPEICHERE…' : 'WERTE SPEICHERN'}</button>
          </>}
          <p className={`cal-state ${calibration.running ? 'active' : ''}`} role="status">{calibration.running ? 'TEST AKTIV' : 'MOTOREN AUS'}</p>
          {message && <p className="cal-message" role="status">{message}</p>}
          {calibration.error && <p className="diagnostics-error" role="alert">{calibration.error}</p>}
        </div>
      </div>
      <div className="cal-navigation"><button className="btn-secondary" disabled={step === 0} onClick={() => switchStep(step - 1)}>ZURÜCK</button>
        <button className="btn-primary" disabled={step === 4} onClick={() => switchStep(step + 1)}>WEITER</button></div>
    </>}
  </section>
}
