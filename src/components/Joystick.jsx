import { useRef, useEffect } from 'react'
import { useJoystick } from '../hooks/useJoystick.js'

const DIR_LABELS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
const DIR_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8]
// angle (degrees clockwise from up) for each direction label position
const DIR_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export default function Joystick({ label, stickId, onChange, onDisarm, armed }) {
  const handleChange = useRef(onChange)
  handleChange.current = onChange

  const onJoystickChange = (dir, str) => {
    if (handleChange.current) handleChange.current(stickId, dir, str)
  }

  const {
    elRef, knobPos, dir, str, active,
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture,
  } = useJoystick(onJoystickChange)

  // Handle pointercancel to trigger disarm
  const handleCancel = (e) => {
    onPointerCancel(e)
    if (onDisarm) onDisarm()
  }

  const handleLostCapture = (e) => {
    onLostPointerCapture(e)
    if (onDisarm) onDisarm()
  }

  // Compute active sector highlight
  const activeSectorIndex = dir > 0 ? dir - 1 : -1
  const glowOpacity = active ? 0.3 + (str / 100) * 0.7 : 0

  return (
    <div className={`joystick-unit ${armed ? 'joystick-armed' : ''}`}>
      <div className="joystick-title-row">
        <span className="joystick-title">{label}</span>
      </div>

      <div className="joystick-container">
        <div
          className="joystick-pad"
          ref={elRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={handleCancel}
          onLostPointerCapture={handleLostCapture}
        >
          {/* Glow ring */}
          <div
            className="joystick-glow-ring"
            style={{
              opacity: active ? glowOpacity : 0,
              boxShadow: active
                ? `0 0 ${20 + str * 0.4}px rgba(0, 217, 255, ${0.2 + str * 0.006})`
                : 'none',
            }}
          />

          {/* SVG with sectors, labels, crosshair */}
          <svg className="joystick-svg" viewBox="0 0 200 200" fill="none">
            <defs>
              <radialGradient id={`grad-${stickId}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(20,30,45,0.8)" />
                <stop offset="70%" stopColor="rgba(10,14,20,0.9)" />
                <stop offset="100%" stopColor="rgba(6,8,12,1)" />
              </radialGradient>
              <linearGradient id={`knob-${stickId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3a9eff" />
                <stop offset="100%" stopColor="#0066cc" />
              </linearGradient>
            </defs>

            {/* Base circle */}
            <circle cx="100" cy="100" r="95" fill={`url(#grad-${stickId})`} stroke="rgba(60,90,130,0.3)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(60,90,130,0.15)" strokeWidth="0.5" />

            {/* 8 sector dividers */}
            {DIR_ANGLES.map((angle, i) => {
              const rad = (angle - 22.5) * Math.PI / 180
              const x2 = 100 + Math.cos(rad) * 88
              const y2 = 100 + Math.sin(rad) * 88
              return (
                <line
                  key={'div-' + i}
                  x1="100" y1="100" x2={x2} y2={y2}
                  stroke="rgba(60,90,130,0.12)"
                  strokeWidth="1"
                />
              )
            })}

            {/* Active sector arc */}
            {activeSectorIndex >= 0 && (
              <path
                d={sectorArcPath(activeSectorIndex)}
                fill="rgba(0, 217, 255, 0.08)"
                stroke="rgba(0, 217, 255, 0.3)"
                strokeWidth="1"
              />
            )}

            {/* Strength rings */}
            <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(60,90,130,0.1)" strokeWidth="0.5" strokeDasharray="2 4" />
            <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(60,90,130,0.1)" strokeWidth="0.5" strokeDasharray="2 4" />

            {/* Crosshair */}
            <line x1="100" y1="40" x2="100" y2="160" stroke="rgba(60,90,130,0.1)" strokeWidth="0.5" />
            <line x1="40" y1="100" x2="160" y2="100" stroke="rgba(60,90,130,0.1)" strokeWidth="0.5" />

            {/* Center dot */}
            <circle cx="100" cy="100" r="3" fill="rgba(100,130,170,0.4)" />

            {/* Direction labels around the ring */}
            {DIR_ANGLES.map((angle, i) => {
              const rad = angle * Math.PI / 180
              const lx = 100 + Math.cos(rad) * 78
              const ly = 100 + Math.sin(rad) * 78
              const isActive = i === activeSectorIndex
              return (
                <text
                  key={'lbl-' + i}
                  x={lx} y={ly}
                  fill={isActive ? '#00d9ff' : 'rgba(120,150,180,0.5)'}
                  fontSize="11"
                  fontWeight={isActive ? '700' : '500'}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ transition: 'fill 0.15s ease' }}
                >
                  {DIR_LABELS[i]}
                </text>
              )
            })}
          </svg>

          {/* Knob */}
          <div
            className="joystick-knob"
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              '--glow-intensity': active ? 0.4 + str * 0.006 : 0,
            }}
          >
            <div className="knob-inner" />
            <div className="knob-shine" />
          </div>
        </div>
      </div>

      {/* Telemetry card */}
      <div className={`telemetry-card ${active ? 'active' : ''}`}>
        <div className="telem-item">
          <span className="telem-label">RICHTUNG</span>
          <div className="telem-value-row">
            <span className="telem-arrow">{dir > 0 ? DIR_LABELS[dir - 1] : '○'}</span>
            <span className="telem-num">{dir}</span>
          </div>
        </div>
        <div className="telem-divider" />
        <div className="telem-item">
          <span className="telem-label">STÄRKE</span>
          <div className="telem-value-row">
            <span className="telem-num">{str}</span>
            <span className="telem-unit">%</span>
          </div>
          {/* Strength bar */}
          <div className="telem-bar">
            <div
              className="telem-bar-fill"
              style={{ width: str + '%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// SVG path for an active sector wedge
function sectorArcPath(index) {
  const startAngle = (index * 45 - 22.5) * Math.PI / 180
  const endAngle = (index * 45 + 22.5) * Math.PI / 180
  const r = 88
  const x1 = 100 + Math.cos(startAngle) * r
  const y1 = 100 + Math.sin(startAngle) * r
  const x2 = 100 + Math.cos(endAngle) * r
  const y2 = 100 + Math.sin(endAngle) * r
  const largeArc = 45 > 180 ? 1 : 0
  return `M 100 100 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}
