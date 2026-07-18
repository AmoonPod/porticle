import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PortRecord } from '../../src/shared/model'
import { PortRow } from '../../src/renderer/src/components/PortRow'

const record: PortRecord = {
  id: 'tcp:ipv4:127.0.0.1:5173:42',
  endpointKey: 'tcp:ipv4:127.0.0.1:5173',
  processToken: '42:start',
  port: 5173,
  protocol: 'tcp',
  family: 'ipv4',
  address: '127.0.0.1',
  scope: 'loopback',
  state: 'listen',
  pid: 42,
  processName: 'node',
  command: 'node vite --host',
  service: { id: 'vite', name: 'Vite', category: 'web', url: 'http://localhost:5173' },
  protected: false
}

describe('PortRow', () => {
  it('shows the key socket identity and exposes fast actions', () => {
    const onToggle = vi.fn()
    const onStop = vi.fn()
    render(
      <PortRow
        record={record}
        watched={false}
        selected
        expanded={false}
        busy={false}
        onSelect={vi.fn()}
        onToggle={onToggle}
        onCopy={vi.fn()}
        onOpen={vi.fn()}
        onWatch={vi.fn()}
        onStop={onStop}
      />
    )
    expect(screen.getByText(':5173')).toBeInTheDocument()
    expect(screen.getByText('Vite')).toBeInTheDocument()
    expect(screen.getByText('TCP4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /port 5173, vite/i }))
    expect(onToggle).toHaveBeenCalledOnce()
    const stopButton = screen.getByRole('button', { name: 'Stop PID 42' })
    expect(stopButton).toHaveTextContent('Stop')
    expect(stopButton.querySelector('svg')).toBeNull()
    fireEvent.click(stopButton)
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('reveals copyable details only when expanded', () => {
    render(
      <PortRow
        record={record}
        watched
        selected
        expanded
        busy={false}
        onSelect={vi.fn()}
        onToggle={vi.fn()}
        onCopy={vi.fn()}
        onOpen={vi.fn()}
        onWatch={vi.fn()}
        onStop={vi.fn()}
      />
    )
    expect(screen.getByText('node vite --host')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unwatch port' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy URL' })).toBeInTheDocument()
  })
})
