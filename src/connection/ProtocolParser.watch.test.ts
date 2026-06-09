import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProtocolParser } from './ProtocolParser'
import { getTerminal } from '../terminal/terminalStore'
import { useWatchStore } from '../stores/watchStore'

vi.mock('../terminal/terminalStore', () => ({
  getTerminal: vi.fn(),
  setTerminal: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  useWatchStore.setState({ roster: [], status: '', currentTargetId: null, connectionStatus: 'disconnected' })
})

describe('ProtocolParser watch-mode frames', () => {
  it('writes a watch frame to the terminal', () => {
    const mockWrite = vi.fn()
    vi.mocked(getTerminal).mockReturnValue({ write: mockWrite } as never)

    ProtocolParser.parseMessage(JSON.stringify({ type: 'watch', data: '\x1b[0mA goblin dies.\r\n' }))

    expect(mockWrite).toHaveBeenCalledWith('\x1b[0mA goblin dies.\r\n')
  })

  it('routes a roster frame into the watch store', () => {
    const roster = [{ entityId: 'id-1', name: 'Mallek', roomId: 'lf:square' }]

    ProtocolParser.parseMessage(JSON.stringify({ type: 'roster', data: roster }))

    expect(useWatchStore.getState().roster).toEqual(roster)
  })

  it('routes a status frame into the watch store', () => {
    ProtocolParser.parseMessage(JSON.stringify({ type: 'status', data: 'Now watching Mallek.' }))

    expect(useWatchStore.getState().status).toBe('Now watching Mallek.')
  })

  it('rejects a roster frame with a malformed entry', () => {
    ProtocolParser.parseMessage(JSON.stringify({ type: 'roster', data: [{ name: 'NoId' }] }))

    expect(useWatchStore.getState().roster).toEqual([])
  })

  it('does not throw on a watch frame when the terminal is not mounted', () => {
    vi.mocked(getTerminal).mockReturnValue(null)
    expect(() => ProtocolParser.parseMessage(JSON.stringify({ type: 'watch', data: 'hi' }))).not.toThrow()
  })
})
