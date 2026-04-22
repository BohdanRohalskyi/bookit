import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SpaceRole = 'owner' | 'administrator' | 'staff'

interface SpaceState {
  businessId: string | null
  businessName: string | null
  role: SpaceRole | null
  locationIds: string[]
  hasHydrated: boolean

  setSpace(params: {
    businessId: string
    businessName: string
    role: SpaceRole
    locationIds: string[]
  }): void
  clearSpace(): void
  setHasHydrated(v: boolean): void
}

export const useSpaceStore = create<SpaceState>()(
  persist(
    (set) => ({
      businessId: null,
      businessName: null,
      role: null,
      locationIds: [],
      hasHydrated: false,

      setSpace: ({ businessId, businessName, role, locationIds }) =>
        set({ businessId, businessName, role, locationIds }),

      clearSpace: () =>
        set({ businessId: null, businessName: null, role: null, locationIds: [] }),

      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'space-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
