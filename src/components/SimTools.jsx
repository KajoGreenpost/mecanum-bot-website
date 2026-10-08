import { Unplug, Plug, RotateCcw, Wrench } from 'lucide-react'

/**
 * Simulation tools panel — only visible in simulation mode.
 * Lets developers test connection-loss, restoration, and reset.
 */
export default function SimTools({ onConnLoss, onRestore, onReset, connLost }) {
  return (
    <div className="sim-tools">
      <div className="sim-tools-title">
        <Wrench size={14} />
        <span>DEV / SIMULATION TOOLS</span>
      </div>
      <div className="sim-tools-buttons">
        <button
          className={`sim-btn ${connLost ? 'active' : ''}`}
          onClick={onConnLoss}
          disabled={connLost}
        >
          <Unplug size={14} />
          Verbindung trennen
        </button>
        <button
          className={`sim-btn ${!connLost ? 'active' : ''}`}
          onClick={onRestore}
          disabled={!connLost}
        >
          <Plug size={14} />
          Verbindung wiederherstellen
        </button>
        <button
          className="sim-btn warn"
          onClick={onReset}
        >
          <RotateCcw size={14} />
          Simulation zurücksetzen
        </button>
      </div>
    </div>
  )
}
