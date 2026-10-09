import { useState, useEffect } from 'react'
import { Gauge, Sliders, RotateCw, Save, Download, Car } from 'lucide-react'
import Slider from './Slider.jsx'
import Toggle from './Toggle.jsx'

const SPEED_MODES = [
  { value: 0, label: '100%', desc: 'Volle Leistung' },
  { value: 1, label: '80%', desc: 'Reduziert' },
  { value: 2, label: '60%', desc: 'Schonmodus' },
]

const FIELD_DESC = {
  startMin: 'Mindestleistung, ab der die Motoren nach dem Anfahren weiterlaufen.',
  boost: 'Kurzer Anfahrimpuls. Darf die gewählten 60 % oder 80 % vorübergehend überschreiten, damit die Motoren anlaufen (Firmware ab 1.0.2).',
  boostTime: 'Dauer des Anfahr-Boosts: 0–100 entspricht 0–300 ms.',
  deadzone: 'Joystick-Bereich um die Mittelstellung, der ignoriert wird.',
}

export default function SettingsPage({ settings, showToast, isSimulation }) {
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const { load } = settings

  useEffect(() => {
    let active = true
    load().then(data => {
      if (!active) return
      setForm({ ...data })
    }).catch(() => {
      if (!active) return
      setLoadError(true)
      showToast('Einstellungen konnten nicht geladen werden.', 'err')
    })
    return () => { active = false }
  }, [load, showToast])

  if (!form) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          {loadError ? <button className="btn-secondary" onClick={() => {
            setLoadError(false)
            load().then(data => setForm({ ...data })).catch(() => setLoadError(true))
          }}>ERNEUT LADEN</button> : <><div className="spinner" /><span>Lade Einstellungen…</span></>}
        </div>
      </div>
    )
  }

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    settings.save(form)
      .then(() => showToast('Einstellungen gespeichert.', 'ok'))
      .catch(() => showToast('Speichern fehlgeschlagen.', 'err'))
  }

  const handleReload = () => {
    settings.load().then(data => {
      setForm({ ...data })
      showToast('Einstellungen neu geladen.', 'ok')
    }).catch(() => {
      showToast('Laden fehlgeschlagen.', 'err')
    })
  }

  return (
    <div className="settings-page">
      <div className="settings-scroll">
        {/* Speed mode */}
        <div className="settings-card">
          <div className="card-header">
            <Gauge size={18} />
            <h2>GESCHWINDIGKEIT</h2>
          </div>
          <div className="speed-modes">
            {SPEED_MODES.map(m => (
              <button
                key={m.value}
                className={`speed-mode-card ${form.speedMode === m.value ? 'active' : ''}`}
                onClick={() => updateField('speedMode', m.value)}
              >
                <span className="speed-label">{m.label}</span>
                <span className="speed-desc">{m.desc}</span>
                {form.speedMode === m.value && <div className="speed-active-dot" />}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <div className="card-header">
            <Sliders size={18} />
            <h2>FAILSAFE</h2>
          </div>
          <Slider
            label="Abschalten nach Loslassen"
            hint="Die Bewegung stoppt sofort. Nach dieser Ruhezeit wird das Fahrzeug deaktiviert. 0 s = sofort. Bei Verbindungsabbruch greift weiterhin der schnelle Sicherheitsstopp."
            value={form.idleTimeoutSeconds ?? 10}
            min={0} max={30} unit=" s"
            onChange={v => updateField('idleTimeoutSeconds', v)}
          />
        </div>

        {/* Motor tuning */}
        <div className="settings-card">
          <div className="card-header">
            <Sliders size={18} />
            <h2>MOTORABSTIMMUNG</h2>
          </div>
          <div className="sliders-grid">
            <Slider
              label="Start-Minimum"
              hint={FIELD_DESC.startMin}
              value={form.startMin}
              min={0} max={100}
              unit=""
              onChange={v => updateField('startMin', v)}
            />
            <Slider
              label="Boost"
              hint={FIELD_DESC.boost}
              value={form.boost}
              min={0} max={100}
              unit=""
              onChange={v => updateField('boost', v)}
            />
            <Slider
              label="Boost-Zeit"
              hint={FIELD_DESC.boostTime}
              value={form.boostTime}
              min={0} max={100}
              unit=""
              onChange={v => updateField('boostTime', v)}
            />
            <Slider
              label="Totzone"
              hint={FIELD_DESC.deadzone}
              value={form.deadzone}
              min={0} max={30}
              unit=""
              onChange={v => updateField('deadzone', v)}
            />
          </div>
        </div>

        {/* Motor inversion with vehicle diagram */}
        <div className="settings-card">
          <div className="card-header">
            <Car size={18} />
            <h2>MOTOR-INVERTIERUNG</h2>
          </div>
          <div className="vehicle-diagram">
            <div className="vehicle-front-label">FRONT</div>
            <div className="wheel-grid">
              <div className="wheel-toggle">
                <Toggle checked={!!form.invertFL} onChange={v => updateField('invertFL', v ? 1 : 0)} />
                <span className="wheel-label">FL</span>
              </div>
              <div className="wheel-toggle">
                <Toggle checked={!!form.invertFR} onChange={v => updateField('invertFR', v ? 1 : 0)} />
                <span className="wheel-label">FR</span>
              </div>
              <div className="vehicle-body">
                <div className="vehicle-body-shape" />
                <div className="vehicle-body-label">RC</div>
              </div>
              <div className="wheel-toggle">
                <Toggle checked={!!form.invertRL} onChange={v => updateField('invertRL', v ? 1 : 0)} />
                <span className="wheel-label">RL</span>
              </div>
              <div className="wheel-toggle">
                <Toggle checked={!!form.invertRR} onChange={v => updateField('invertRR', v ? 1 : 0)} />
                <span className="wheel-label">RR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Direction inversion */}
        <div className="settings-card">
          <div className="card-header">
            <RotateCw size={18} />
            <h2>RICHTUNGS-INVERTIERUNG</h2>
          </div>
          <div className="dir-toggles">
            <div className="dir-toggle-row">
              <span className="dir-toggle-label">Vor / Zurück</span>
              <Toggle checked={!!form.invertMoveY} onChange={v => updateField('invertMoveY', v ? 1 : 0)} />
            </div>
            <div className="dir-toggle-row">
              <span className="dir-toggle-label">Links / Rechts</span>
              <Toggle checked={!!form.invertMoveX} onChange={v => updateField('invertMoveX', v ? 1 : 0)} />
            </div>
            <div className="dir-toggle-row">
              <span className="dir-toggle-label">Drehung</span>
              <Toggle checked={!!form.invertTurn} onChange={v => updateField('invertTurn', v ? 1 : 0)} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <button className="btn-secondary" onClick={handleReload} disabled={settings.loading || settings.saving}>
            <Download size={16} />
            NEU LADEN
          </button>
          <button className="btn-primary btn-large" onClick={handleSave} disabled={settings.saving}>
            <Save size={18} />
            {settings.saving ? 'SPEICHERE…' : 'EINSTELLUNGEN SPEICHERN'}
          </button>
        </div>
      </div>
    </div>
  )
}
