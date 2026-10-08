export default function Slider({ label, hint, value, min, max, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{value}{unit}</span>
      </div>
      <div className="slider-track-wrap">
        <div className="slider-track">
          <div className="slider-fill" style={{ width: pct + '%' }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          className="slider-input"
        />
      </div>
      {hint && <p className="slider-hint">{hint}</p>}
    </div>
  )
}
