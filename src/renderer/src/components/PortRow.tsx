import {
  ChevronDown,
  Copy,
  ExternalLink,
  LoaderCircle,
  Pin,
  PinOff,
  Shield,
  Terminal
} from 'lucide-react'
import type { CopyField, PortRecord } from '../../../shared/model'
import { IconButton } from './IconButton'

interface PortRowProps {
  record: PortRecord
  watched: boolean
  selected: boolean
  expanded: boolean
  busy: boolean
  onSelect: () => void
  onToggle: () => void
  onCopy: (field: CopyField) => void
  onOpen: () => void
  onWatch: () => void
  onStop: () => void
}

export function PortRow({
  record,
  watched,
  selected,
  expanded,
  busy,
  onSelect,
  onToggle,
  onCopy,
  onOpen,
  onWatch,
  onStop
}: PortRowProps): React.JSX.Element {
  const serviceName = record.service?.name ?? record.processName
  const processLine = record.service
    ? record.processName
    : record.command
      ? shortCommand(record.command)
      : 'Process'
  const family = record.family === 'ipv4' ? '4' : '6'
  const hasQuickActions = Boolean(record.service?.url) || !record.protected

  return (
    <article
      className={`port-row${selected ? ' is-selected' : ''}${expanded ? ' is-expanded' : ''}${hasQuickActions ? ' has-quick-actions' : ''}`}
      data-record-id={record.id}
      aria-label={`Port ${record.port}, ${serviceName}, ${record.protocol.toUpperCase()}`}
      onMouseEnter={onSelect}
    >
      <div className="port-row__surface">
        <button
          type="button"
          className="port-row__primary"
          onClick={() => {
            onSelect()
            onToggle()
          }}
          aria-label={`Port ${record.port}, ${serviceName}; show details`}
          aria-expanded={expanded}
        >
          <span
            className={`service-signal service-signal--${record.service?.category ?? 'other'}`}
          />
          <span className="port-number">:{record.port}</span>
          <span className="port-identity">
            <span className="service-name">
              {serviceName}
              {record.protected ? (
                <Shield className="protected-icon" aria-label="Protected process" />
              ) : null}
            </span>
            <span className="process-line">{processLine}</span>
          </span>
          <span className="endpoint-meta">
            <span>
              {record.protocol.toUpperCase()}
              {family}
            </span>
            <span className="endpoint-address">{displayAddress(record.address)}</span>
          </span>
          <ChevronDown className="row-chevron" aria-hidden="true" />
        </button>

        <div className="port-row__quick-actions">
          {record.service?.url ? (
            <IconButton
              size="small"
              icon={ExternalLink}
              label={`Open localhost on port ${record.port}`}
              onClick={onOpen}
            />
          ) : null}
          {!record.protected ? (
            <button
              type="button"
              className="stop-button"
              aria-label={`Stop PID ${record.pid}`}
              title={`Stop ${record.processName} (PID ${record.pid})`}
              disabled={busy}
              onClick={onStop}
            >
              {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
              {busy ? 'Stopping' : 'Stop'}
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="port-detail">
          <DetailLine
            label="Address"
            value={`${displayAddress(record.address)}:${record.port}`}
            onCopy={() => onCopy('address')}
          />
          <DetailLine label="PID" value={String(record.pid)} onCopy={() => onCopy('pid')} />
          <div className="detail-command">
            <span className="detail-label">Command</span>
            <code>{record.command ?? record.executable ?? 'Unavailable for this process'}</code>
            {record.command ? (
              <IconButton
                size="small"
                icon={Copy}
                label="Copy command"
                onClick={() => onCopy('command')}
              />
            ) : null}
          </div>
          <div className="detail-actions">
            <button type="button" className="text-action" onClick={onWatch}>
              {watched ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
              {watched ? 'Unwatch port' : 'Watch port'}
            </button>
            <button type="button" className="text-action" onClick={() => onCopy('port')}>
              <Copy aria-hidden="true" /> Copy port
            </button>
            {record.service?.url ? (
              <button type="button" className="text-action" onClick={() => onCopy('url')}>
                <Terminal aria-hidden="true" /> Copy URL
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}

interface DetailLineProps {
  label: string
  value: string
  onCopy: () => void
}

function DetailLine({ label, value, onCopy }: DetailLineProps): React.JSX.Element {
  return (
    <div className="detail-line">
      <span className="detail-label">{label}</span>
      <code>{value}</code>
      <IconButton size="small" icon={Copy} label={`Copy ${label.toLowerCase()}`} onClick={onCopy} />
    </div>
  )
}

function shortCommand(command: string): string {
  const compact = command.replace(/\s+/g, ' ').trim()
  return compact.length > 46 ? `${compact.slice(0, 43)}…` : compact
}

function displayAddress(address: string): string {
  return address === '0.0.0.0' || address === '::' || address === '*' ? '*' : address
}
