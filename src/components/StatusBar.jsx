import { Wifi, WifiOff, Radio, ShieldCheck, ShieldAlert, Zap, Eye, Cpu } from 'lucide-react'

export default function StatusBar({ connState, armed, latency, isSimulation, environmentLabel, onReconnect }) {
  const online = connState === 'online'
  const connecting = connState === 'connecting'
  const lost = connState === 'lost'

  return (
    <header className="status-bar">
      <div className="status-left">
        <div className="status-logo">
          <div className="logo-mark">
            <Radio size={18} />
          </div>
          <div className="logo-text">
            <div className="logo-title">RC MECANUM</div>
            <div className="logo-sub">ESP32 Vehicle Control</div>
          </div>
        </div>
      </div>

      <div className="status-right">
        {/* Environment badge */}
        <div className={`hud-badge env-badge ${isSimulation ? 'sim' : 'esp'}`}>
          <Cpu size={13} />
          <span>{environmentLabel}</span>
        </div>

        {/* Connection state */}
        <div className={`hud-badge ${isSimulation ? 'sim' : online ? 'online' : connecting ? 'connecting' : 'lost'}`}>
          {isSimulation ? <Wifi size={13} /> : online ? <Wifi size={13} /> : connecting ? <Radio size={13} /> : <WifiOff size={13} />}
          <span>{isSimulation ? 'SIM' : online ? 'ONLINE' : connecting ? 'CONNECTING' : 'LOST'}</span>
          {(online || isSimulation) && <div className={`hud-pulse ${isSimulation ? 'sim-pulse' : ''}`} />}
        </div>

        {/* ARM / SAFE */}
        <div className={`hud-badge ${armed ? 'armed' : 'safe'}`}>
          {armed ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
          <span>{armed ? 'ARMED' : 'SAFE'}</span>
        </div>

        {/* Heartbeat */}
        <div className="hud-badge heartbeat">
          <Zap size={13} />
          <span>{armed ? '20Hz' : '1Hz'}</span>
        </div>

        {/* Latency */}
        <div className="hud-badge latency">
          <span className="lat-val">{isSimulation ? 'SIM' : latency + 'ms'}</span>
        </div>

        <button className="hud-maint-btn" onClick={onReconnect} title="Verbindung prüfen">
          <Eye size={14} />
        </button>
      </div>
    </header>
  )
}
