import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const Icon = toast.type === 'ok' ? CheckCircle2 : toast.type === 'err' ? XCircle : Info
  const color = toast.type === 'ok' ? 'var(--green)' : toast.type === 'err' ? 'var(--red)' : 'var(--cyan)'

  return (
    <div className="toast" style={{ '--toast-color': color }}>
      <Icon size={18} />
      <span>{toast.msg}</span>
    </div>
  )
}
