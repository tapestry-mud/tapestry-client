import { describe, it, expect, beforeEach } from 'vitest'
import { useWatchStore } from './watchStore'

beforeEach(() => {
  useWatchStore.setState({ roster: [], status: '', currentTargetId: null, connectionStatus: 'disconnected' })
})

describe('watchStore', () => {
  it('starts empty and disconnected', () => {
    const s = useWatchStore.getState()
    expect(s.roster).toEqual([])
    expect(s.status).toBe('')
    expect(s.currentTargetId).toBeNull()
    expect(s.connectionStatus).toBe('disconnected')
  })

  it('setRoster updates the roster', () => {
    useWatchStore.getState().setRoster([{ entityId: 'a', name: 'A', roomId: '' }])
    expect(useWatchStore.getState().roster).toHaveLength(1)
  })

  it('setStatus / setCurrentTargetId / setConnectionStatus update state', () => {
    useWatchStore.getState().setStatus('watching')
    useWatchStore.getState().setCurrentTargetId('a')
    useWatchStore.getState().setConnectionStatus('connected')

    const s = useWatchStore.getState()
    expect(s.status).toBe('watching')
    expect(s.currentTargetId).toBe('a')
    expect(s.connectionStatus).toBe('connected')
  })
})
