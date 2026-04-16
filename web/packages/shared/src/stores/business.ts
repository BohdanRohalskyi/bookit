import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BusinessState {
  activeBusinessId: string | null
  setActiveBusiness: (id: string) => void
  clearActiveBusiness: () => void
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      activeBusinessId: null,
      setActiveBusiness: (id) => set({ activeBusinessId: id }),
      clearActiveBusiness: () => set({ activeBusinessId: null }),
    }),
    {
      name: 'business-storage',
    }
  )
)
