export default function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      className={`toggle-switch ${checked ? 'on' : 'off'}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
    >
      <div className="toggle-track">
        <div className="toggle-thumb" />
      </div>
    </button>
  )
}
