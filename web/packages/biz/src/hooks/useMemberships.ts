import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@bookit/shared/stores'
import { getMemberships } from '../api/staffApi'

export function useMemberships({ enabled = true }: { enabled?: boolean } = {}) {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: ['memberships'],
    queryFn: getMemberships,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  })
}
