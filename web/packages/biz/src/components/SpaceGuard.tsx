import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@bookit/shared/stores'
import { getMemberships } from '../api/staffApi'
import { useSpaceStore } from '../stores/spaceStore'
import { SpacePicker } from '../pages/SpacePicker'

export function SpaceGuard() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const setSpace = useSpaceStore((s) => s.setSpace)

  const { data, isLoading } = useQuery({
    queryKey: ['memberships'],
    queryFn: getMemberships,
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }
    if (!data) return

    const { owned, memberships } = data
    const total = owned.length + memberships.length

    if (total === 0) {
      navigate('/dashboard', { replace: true })
      return
    }

    if (total === 1) {
      if (owned.length === 1) {
        setSpace({ businessId: owned[0].business_id, businessName: owned[0].business_name, role: 'owner', locationIds: [] })
      } else {
        const m = memberships[0]
        setSpace({ businessId: m.business_id, businessName: m.business_name, role: m.role, locationIds: m.location_ids })
      }
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, data, navigate, setSpace])

  if (!isAuthenticated) return null

  if (isLoading || !data || (data.owned.length + data.memberships.length) <= 1) {
    return (
      <div className="min-h-screen bg-[#020905] flex items-center justify-center">
        <div className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return <SpacePicker />
}
