import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'
import { useBusinessStore } from '@bookit/shared/stores'

type Business = components['schemas']['Business']

export function BusinessSelector() {
  const { activeBusinessId, setActiveBusiness } = useBusinessStore()

  const { data, isLoading } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/businesses')
      return data ?? null
    },
  })

  const businesses: Business[] = data?.data ?? []

  // Auto-select first business when list loads and nothing is selected
  useEffect(() => {
    if (!activeBusinessId && businesses.length > 0) {
      setActiveBusiness(businesses[0].id)
    }
  }, [businesses, activeBusinessId, setActiveBusiness])

  if (isLoading) {
    return (
      <div className="h-9 w-48 bg-black/5 rounded-[6px] animate-pulse" />
    )
  }

  if (businesses.length === 0) {
    return (
      <span className="text-sm text-[rgba(2,9,5,0.4)] italic">No businesses yet</span>
    )
  }

  return (
    <div className="relative flex items-center">
      <select
        value={activeBusinessId ?? ''}
        onChange={(e) => setActiveBusiness(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm font-medium text-[#020905] bg-[#f2f4f3] border border-[rgba(2,9,5,0.12)] rounded-[6px] outline-none focus:border-[#1069d1] focus:bg-white transition-colors cursor-pointer"
      >
        {businesses.map((biz) => (
          <option key={biz.id} value={biz.id}>
            {biz.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 size-3.5 text-[rgba(2,9,5,0.4)] pointer-events-none" />
    </div>
  )
}
