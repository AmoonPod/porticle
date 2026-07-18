import { AlertTriangle, Check, Info, X } from 'lucide-react'

export type ToastTone = 'success' | 'warning' | 'info'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

interface ToastProps {
  toast: ToastMessage
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps): React.JSX.Element {
  const Icon = toast.tone === 'success' ? Check : toast.tone === 'warning' ? AlertTriangle : Info
  return (
    <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
      <Icon aria-hidden="true" />
      <span>{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">
        <X aria-hidden="true" />
      </button>
    </div>
  )
}
