/**
 * Developer telemetry panel — only shown in simulation mode.
 * Displays the live control frame and simulated wheel values.
 */

// Approximate Mecanum wheel calculation for visualization only.
// Not exact firmware logic — just for UI testing.
function calcWheels(frame) {
  const { s1_dir, s1_str, s2_dir, s2_str, en } = frame
  if (!en) return { FL: 0, FR: 0, RL: 0, RR: 0 }

  // Stick 1: movement + rotation
  let fwd = 0, strafe = 0, turn = 0
  const s1 = s1_str / 100
  const s2 = s2_str / 100

  // Stick 1 direction → forward/turn components
  switch (s1_dir) {
    case 1: fwd = s1; break
    case 2: fwd = s1 * 0.7; turn = s1 * 0.7; break
    case 3: turn = s1; break
    case 4: fwd = -s1 * 0.7; turn = s1 * 0.7; break
    case 5: fwd = -s1; break
    case 6: fwd = -s1 * 0.7; turn = -s1 * 0.7; break
    case 7: turn = -s1; break
    case 8: fwd = s1 * 0.7; turn = -s1 * 0.7; break
  }

  // Stick 2 direction → strafe components
  switch (s2_dir) {
    case 2: strafe = s2 * 0.7; fwd += s2 * 0.7; break
    case 3: strafe = s2; break
    case 4: strafe = s2 * 0.7; fwd -= s2 * 0.7; break
    case 6: strafe = -s2 * 0.7; fwd -= s2 * 0.7; break
    case 7: strafe = -s2; break
    case 8: strafe = -s2 * 0.7; fwd += s2 * 0.7; break
  }

  // Mecanum mixing (simplified)
  let fl = fwd + strafe + turn
  let fr = fwd - strafe - turn
  let rl = fwd - strafe + turn
  let rr = fwd + strafe - turn

  // Clamp
  const clamp = v => Math.max(-100, Math.min(100, Math.round(v * 100)))

  return {
    FL: clamp(fl),
    FR: clamp(fr),
    RL: clamp(rl),
    RR: clamp(rr),
  }
}

function WheelGauge({ label, value }) {
  const isPositive = value >= 0
  const absVal = Math.abs(value)
  return (
    <div className="wheel-gauge">
      <span className="wg-label">{label}</span>
      <div className="wg-bar-wrap">
        <div className="wg-bar-center" />
        <div
          className={`wg-bar-fill ${isPositive ? 'pos' : 'neg'}`}
          style={{ width: absVal / 2 + '%' }}
        />
      </div>
      <span className={`wg-val ${isPositive ? 'pos' : 'neg'}`}>
        {isPositive ? '+' : ''}{value}%
      </span>
    </div>
  )
}

export default function DevTelemetry({ frame }) {
  const wheels = calcWheels(frame)

  return (
    <div className="dev-telemetry">
      <div className="dev-section">
        <div className="dev-section-title">CONTROL FRAME</div>
        <div className="dev-frame-grid">
          <div className="dev-frame-item">
            <span className="df-key">s1_dir</span>
            <span className="df-val">{frame.s1_dir}</span>
          </div>
          <div className="dev-frame-item">
            <span className="df-key">s1_str</span>
            <span className="df-val">{frame.s1_str}</span>
          </div>
          <div className="dev-frame-item">
            <span className="df-key">s2_dir</span>
            <span className="df-val">{frame.s2_dir}</span>
          </div>
          <div className="dev-frame-item">
            <span className="df-key">s2_str</span>
            <span className="df-val">{frame.s2_str}</span>
          </div>
          <div className="dev-frame-item">
            <span className="df-key">en</span>
            <span className={`df-val ${frame.en ? 'armed' : ''}`}>{frame.en}</span>
          </div>
        </div>
      </div>

      <div className="dev-section">
        <div className="dev-section-title">SIMULATED WHEELS</div>
        <div className="wheel-gauges">
          <WheelGauge label="FL" value={wheels.FL} />
          <WheelGauge label="FR" value={wheels.FR} />
          <WheelGauge label="RL" value={wheels.RL} />
          <WheelGauge label="RR" value={wheels.RR} />
        </div>
      </div>
    </div>
  )
}
