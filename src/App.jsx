import { useState, useCallback } from 'react'
import { Activity } from 'lucide-react'
import { useControlState } from './hooks/useControlState.js'
import { useSettings } from './hooks/useSettings.js'
import { vehicleApi } from './api/vehicleApi.js'
import StatusBar from './components/StatusBar.jsx'
import TabNav from './components/TabNav.jsx'
import ControlPage from './components/ControlPage.jsx'
import SettingsPage from './components/SettingsPage.jsx'
import SystemPage from './components/SystemPage.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  const [tab, setTab] = useState('control')
  const [toast, setToast] = useState(null)

  const ctrl = useControlState()
  const settings = useSettings()

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: Date.now() })
  }, [])

  const changeTab = (nextTab) => {
    if (nextTab !== 'control') ctrl.disarmNow()
    setTab(nextTab)
  }

  // Only show connection-lost overlay in REAL mode.
  // In simulation, the SimTools panel handles connection loss testing separately.
  const showConnOverlay = ctrl.connState === 'lost' && !ctrl.isSimulation

  return (
    <div className="app-shell">
      <div className="bg-grid" />
      <div className="bg-glow" />

      <div className="app-content">
        <StatusBar
          connState={ctrl.connState}
          armed={ctrl.armed}
          latency={ctrl.latency}
          isSimulation={ctrl.isSimulation}
          environmentLabel={ctrl.environmentLabel}
          onReconnect={ctrl.reconnect}
        />

        <TabNav tab={tab} onChange={changeTab} />

        <main className="main-area">
          {tab === 'control' && (
            <ControlPage ctrl={ctrl} />
          )}
          {tab === 'settings' && (
            <SettingsPage settings={settings} showToast={showToast} isSimulation={ctrl.isSimulation} />
          )}
          {tab === 'system' && (
            <SystemPage isSimulation={ctrl.isSimulation} />
          )}
        </main>
      </div>

      {toast && <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />}

      {/* Connection lost overlay — REAL mode only */}
      {showConnOverlay && (
        <div className="conn-overlay">
          <div className="conn-overlay-card">
            <div className="conn-overlay-icon">
              <Activity size={40} />
            </div>
            <h2>VERBINDUNG VERLOREN</h2>
            <p>Fahrzeug wurde deaktiviert (Sicherheitsstopp).</p>
            <button className="btn-primary" onClick={ctrl.reconnect}>
              ERNEUT VERBINDEN
            </button>
          </div>
        </div>
      )}

      {/* Simulated connection-lost overlay — simulation mode only */}
      {ctrl.isSimulation && ctrl.connState === 'lost' && (
        <div className="conn-overlay">
          <div className="conn-overlay-card">
            <div className="conn-overlay-icon">
              <Activity size={40} />
            </div>
            <h2>VERBINDUNG VERLOREN</h2>
            <p>Fahrzeug wurde deaktiviert (Sicherheitsstopp — Simulation).</p>
            <button className="btn-primary" onClick={ctrl.restoreConnection}>
              ERNEUT VERBINDEN
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
