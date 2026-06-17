import { create } from 'zustand'

interface CommandPaletteState {
  isOpen: boolean
  filter: string
  open: (filter?: string) => void
  close: () => void
  setFilter: (filter: string) => void
}

export const useCommandPaletteStore = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  filter: '',
  open: (filter) => set({ isOpen: true, filter: filter ?? '' }),
  close: () => set({ isOpen: false }),
  setFilter: (filter) => set({ filter }),
}))
