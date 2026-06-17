import { create } from 'zustand'
import { useHelpStore } from './helpStore'
import { useCommandPaletteStore } from './commandPaletteStore'

interface CommandBarState {
  pending: string
  focusToken: number
  setPending: (cmd: string) => void
  clearPending: () => void
  requestFocus: () => void
}

export const useCommandBarStore = create<CommandBarState>()((set) => ({
  pending: '',
  focusToken: 0,
  setPending: (cmd) => set({ pending: cmd }),
  clearPending: () => set({ pending: '' }),
  requestFocus: () => {
    if (useHelpStore.getState().isOpen) { return }
    if (useCommandPaletteStore.getState().isOpen) { return }
    set((s) => ({ focusToken: s.focusToken + 1 }))
  },
}))
