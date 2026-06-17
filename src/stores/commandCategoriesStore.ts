import { create } from 'zustand'
import type { CommandCategory } from '../types/gmcp'

interface CommandCategoriesState {
  categories: CommandCategory[]
  setCategories: (categories: CommandCategory[]) => void
}

export const useCommandCategoriesStore = create<CommandCategoriesState>()((set) => ({
  categories: [],
  setCategories: (categories) => set({ categories }),
}))
