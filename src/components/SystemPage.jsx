import { useState } from 'react'
import { ServerCog, Cpu, HardDrive, Shield, FileText, RotateCcw, Info, ExternalLink, X, Terminal } from 'lucide-react'
import { vehicleApi } from '../api/vehicleApi.js'

const FEATURES = [
  { icon: Cpu, label: 'Firmware .bin Update' },
  { icon: HardDrive, label: 'LittleFS .bin Update' },
  { icon: Shield, label: 'SHA-256 Verifikation' },
  { icon: FileText, label: 'Einstellungen Export/Import' },
  { icon: RotateCcw, label: 'Werksreset' },
  { icon: Info, label: 'Systeminformationen & Neustart' },
]

export default function SystemPage({ isSimulation }) {
  const [showSimModal, setShowSimModal] = useState(false)

  const handleMaintenance = (e) => {
    if (isSimulation) {
      e.preventDefault()
      setShowSimModal(true)
    }
  }

  return (
    <div className="system-page">
      <div className="system-card">
        <div className="system-header">
          <div className="system-icon">
            <ServerCog size={32} />
          </div>
          <h2>SYSTEMWARTUNG</h2>
          <p className="system-desc">
            Firmware-Updates, Dateisystem-Updates und Recovery werden über die
            integrierte Wartungsseite des ESP32 durchgeführt.
          </p>
        </div>

        <div className="system-features">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div className="feature-item" key={i}>
                <div className="feature-icon">
                  <Icon size={18} />
                </div>
                <span>{f.label}</span>
              </div>
            )
          })}
        </div>

        {isSimulation ? (
          <button className="system-btn" onClick={handleMaintenance}>
            <ServerCog size={20} />
            <span>MAINTENANCE & UPDATES ÖFFNEN</span>
            <ExternalLink size={16} />
          </button>
        ) : (
          <a href={vehicleApi.maintenanceUrl} className="system-btn">
            <ServerCog size={20} />
            <span>MAINTENANCE & UPDATES ÖFFNEN</span>
            <ExternalLink size={16} />
          </a>
        )}

        <p className="system-note">
          Die Wartungsseite ist fest in der ESP32-Firmware eingebettet und
          unabhängig vom Dateisystem. Sie ist auch verfügbar, wenn das
          Web-Interface nicht geladen werden kann.
        </p>
      </div>

      {showSimModal && <SimMaintenanceModal onClose={() => setShowSimModal(false)} />}
    </div>
  )
}

function SimMaintenanceModal({ onClose }) {
  const mockInfo = [
    { label: 'Firmware', value: '1.0.0 (simuliert)' },
    { label: 'Web UI', value: '1.1.2 (simuliert)' },
    { label: 'OTA Firmware Update', value: 'Simuliert — kein echtes Update' },
    { label: 'LittleFS Update', value: 'Simuliert — kein echtes Update' },
    { label: 'Settings Backup', value: 'Simuliert — localStorage' },
    { label: 'SHA-256 Verifikation', value: 'Simuliert' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">
            <Terminal size={24} />
          </div>
          <h2>SIMULATED MAINTENANCE</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="modal-desc">
          Die Wartungsschnittstelle wird von der ESP32-Firmware bereitgestellt
          und ist nur auf dem Fahrzeug verfügbar. Dies ist eine simulierte Ansicht
          für Entwicklung und Testing.
        </p>

        <div className="modal-info-list">
          {mockInfo.map((item, i) => (
            <div className="modal-info-row" key={i}>
              <span className="mi-label">{item.label}</span>
              <span className="mi-value">{item.value}</span>
            </div>
          ))}
        </div>

        <button className="btn-secondary" onClick={onClose}>
          SCHLIESSEN
        </button>
      </div>
    </div>
  )
}
