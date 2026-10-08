import { Power, ShieldAlert, RotateCw } from 'lucide-react'
import Joystick from './Joystick.jsx'
import DevTelemetry from './DevTelemetry.jsx'
import SimTools from './SimTools.jsx'

export default function ControlPage({ ctrl }) {
  const handleStickChange = (stickId, dir, str) => {
    ctrl.updateStick(stickId, dir, str)
  }

  const handleDisarm = () => {
    ctrl.disarmNow()
  }

  const connLost = ctrl.connState === 'lost'

  return (
    <div className="control-page">
      <div className="joystick-stage">
        <Joystick
          label="FAHREN / DREHEN"
          stickId={1}
          onChange={handleStickChange}
          onDisarm={handleDisarm}
          armed={ctrl.armed}
        />
        {/* A dedicated center column keeps the safety control clear of both sticks. */}
        <div className="arm-section">
          <button
            className={`arm-control ${ctrl.armed ? 'armed' : 'disarmed'}`}
            onClick={ctrl.toggleArm}
            disabled={ctrl.connState !== 'online'}
          >
            <div className="arm-bg-glow" />
            <div className="arm-icon-wrap">
              {ctrl.armed ? <ShieldAlert size={28} /> : <Power size={28} />}
            </div>
            <div className="arm-text-block">
              <span className="arm-title">{ctrl.armed ? 'STOPP' : 'AKTIVIEREN'}</span>
              <span className="arm-sub">{ctrl.armed ? 'MOTOREN AKTIV' : 'MOTOREN AUS'}</span>
            </div>
            <div className={`arm-status-led ${ctrl.armed ? 'on' : 'off'}`} />
          </button>
        </div>
        <Joystick
          label="SEITE / DIAGONAL"
          stickId={2}
          onChange={handleStickChange}
          onDisarm={handleDisarm}
          armed={ctrl.armed}
        />
      </div>

      <div className="orientation-hint" role="status">
        <RotateCw size={32} />
        <strong>Handy ins Querformat drehen</strong>
        <span>Die Steuerung braucht Platz für beide Daumen.</span>
      </div>

      {/* Simulation-only dev panels */}
      {ctrl.isSimulation && (
        <div className="dev-panels">
          <DevTelemetry frame={ctrl.lastFrame} />
          <SimTools
            connLost={connLost}
            onConnLoss={ctrl.simulateConnectionLoss}
            onRestore={ctrl.restoreConnection}
            onReset={() => {
              ctrl.disarmNow()
              ctrl.restoreConnection()
            }}
          />
        </div>
      )}
    </div>
  )
}
