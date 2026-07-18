import { PinOff, Radio } from 'lucide-react'

interface IdlePortRowProps {
  port: number
  onUnwatch: () => void
}

export function IdlePortRow({ port, onUnwatch }: IdlePortRowProps): React.JSX.Element {
  return (
    <article className="port-row idle-port-row" aria-label={`Watched port ${port} is free`}>
      <div className="port-row__surface">
        <div className="idle-port-row__content">
          <span className="service-signal service-signal--idle" />
          <span className="port-number">:{port}</span>
          <span className="port-identity">
            <span className="service-name">Port is free</span>
            <span className="process-line">Watching for a listener</span>
          </span>
          <span className="idle-badge">
            <Radio aria-hidden="true" /> watched
          </span>
        </div>
        <div className="port-row__quick-actions">
          <button
            className="icon-button icon-button--small"
            type="button"
            onClick={onUnwatch}
            aria-label={`Stop watching port ${port}`}
            title="Unwatch port"
          >
            <PinOff aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
