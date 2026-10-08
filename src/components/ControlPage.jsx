import { Power, ShieldCheck, ShieldAlert } from 'lucide-react'
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
        <Joystick
          label="SEITE / DIAGONAL"
          stickId={2}
          onChange={handleStickChange}
          onDisarm={handleDisarm}
          armed={ctrl.armed}
        />
      </div>

      {/* ARM / DISARM control */}
      <div className="arm-section">
        <button
          className={`arm-control ${ctrl.armed ? 'armed' : 'disarmed'}`}
          onClick={ctrl.toggleArm}
        >
          <div className="arm-bg-glow" />
          <div className="arm-icon-wrap">
            {ctrl.armed ? <ShieldAlert size={28} /> : <Power size={28} />}
          </div>
          <div className="arm-text-block">
            <span className="arm-title">
              {ctrl.armed ? 'VEHICLE ARMED' : 'VEHICLE SAFE'}
            </span>
            <span className="arm-sub">
              {ctrl.armed ? 'CONTROL ACTIVE' : 'MOTORS DISABLED'}
            </span>
          </div>
          <div className={`arm-status-led ${ctrl.armed ? 'on' : 'off'}`} />
        </button>
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
