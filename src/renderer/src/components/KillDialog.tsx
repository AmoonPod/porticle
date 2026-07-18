import type { AppSettings, PortRecord } from '../../../shared/model'

interface KillDialogProps {
  record: PortRecord
  settings: AppSettings
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function KillDialog({
  record,
  settings,
  busy,
  onCancel,
  onConfirm
}: KillDialogProps): React.JSX.Element {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="stop-title"
        aria-describedby="stop-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="stop-title">Stop {record.processName}?</h2>
        <p id="stop-description">
          This stops PID {record.pid} and its child processes, freeing port {record.port}.
        </p>
        <p className="dialog-note">
          {settings.forceKillAfterMs > 0
            ? `If needed, Porticle will force stop it after ${settings.forceKillAfterMs / 1000} seconds.`
            : 'Force fallback is off.'}
        </p>
        <div className="dialog-actions">
          <button type="button" className="button button--quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Stopping…' : 'Stop process'}
          </button>
        </div>
      </section>
    </div>
  )
}
