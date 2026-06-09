import { create } from 'zustand'
import type { WatchRosterEntry } from '../types/gmcp'

export type WatchConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface WatchState {
  roster: WatchRosterEntry[]
  status: string
  currentTargetId: string | null
  connectionStatus: WatchConnectionStatus
  setRoster: (roster: WatchRosterEntry[]) => void
  setStatus: (status: string) => void
  setCurrentTargetId: (currentTargetId: string | null) => void
  setConnectionStatus: (connectionStatus: WatchConnectionStatus) => void
}

/// State for the anonymous /watch spectator page (Slice B). Fed by `roster`/`status` frames via
/// ProtocolParser and by the WatchClient connection lifecycle. Separate from connectionStore so the
/// watch surface never touches the player login/preauth flow.
export const useWatchStore = create<WatchState>()((set) => ({
  roster: [],
  status: '',
  currentTargetId: null,
  connectionStatus: 'disconnected',
  setRoster: (roster) => set({ roster }),
  setStatus: (status) => set({ status }),
  setCurrentTargetId: (currentTargetId) => set({ currentTargetId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}))
