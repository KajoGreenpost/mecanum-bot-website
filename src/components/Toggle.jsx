export default function Toggle({ checked, onChange }) {
  return (
    <button
      className={`toggle-switch ${checked ? 'on' : 'off'}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <div className="toggle-track">
        <div className="toggle-thumb" />
      </div>
    </button>
  )
}
