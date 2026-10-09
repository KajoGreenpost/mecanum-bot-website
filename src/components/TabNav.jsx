import { Gamepad2, SlidersHorizontal, ServerCog, Terminal } from 'lucide-react'

const TABS = [
  { id: 'control', label: 'STEUERUNG', icon: Gamepad2 },
  { id: 'settings', label: 'EINSTELLUNGEN', icon: SlidersHorizontal },
  { id: 'system', label: 'SYSTEM', icon: ServerCog },
  { id: 'diagnostics', label: 'DIAGNOSE', icon: Terminal },
]

export default function TabNav({ tab, onChange }) {
  return (
    <nav className="tab-nav">
      {TABS.map(t => {
        const Icon = t.icon
        const active = tab === t.id
        return (
          <button
            key={t.id}
            className={`tab-item ${active ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <Icon size={16} />
            <span>{t.label}</span>
            {active && <div className="tab-indicator" />}
          </button>
        )
      })}
    </nav>
  )
}
