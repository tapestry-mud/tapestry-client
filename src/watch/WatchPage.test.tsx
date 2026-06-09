import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WatchPage } from './WatchPage'
import { useWatchStore } from '../stores/watchStore'

const mockConnect = vi.hoisted(() => vi.fn())
const mockDisconnect = vi.hoisted(() => vi.fn())
const mockWatch = vi.hoisted(() => vi.fn())

vi.mock('../connection/WatchClient', () => ({
  WatchClient: {
    connect: mockConnect,
    disconnect: mockDisconnect,
    watch: mockWatch,
    unwatch: vi.fn(),
    send: vi.fn(),
  },
}))

// OutputViewport mounts a real xterm (canvas); stub it for the page-wiring test.
vi.mock('../panels/OutputViewport', () => ({ OutputViewport: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  useWatchStore.setState({ roster: [], status: '', currentTargetId: null, connectionStatus: 'disconnected' })
})

describe('WatchPage', () => {
  it('opens the watch connection on mount', () => {
    render(<WatchPage />)
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it('watches a player when its roster entry is clicked', () => {
    useWatchStore.setState({
      roster: [{ entityId: 'id-1', name: 'Mallek', roomId: 'lf:square' }],
      status: '',
      currentTargetId: null,
      connectionStatus: 'connected',
    })

    render(<WatchPage />)
    fireEvent.click(screen.getByText('Mallek'))

    expect(mockWatch).toHaveBeenCalledWith('id-1')
  })

  it('next watches the first entry when nothing is selected yet', () => {
    useWatchStore.setState({
      roster: [
        { entityId: 'id-1', name: 'Alpha', roomId: '' },
        { entityId: 'id-2', name: 'Bravo', roomId: '' },
      ],
      status: '',
      currentTargetId: null,
      connectionStatus: 'connected',
    })

    render(<WatchPage />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(mockWatch).toHaveBeenCalledWith('id-1')
  })
})
