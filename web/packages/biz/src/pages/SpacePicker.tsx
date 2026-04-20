import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@bookit/shared/stores'
import { Building2, LogOut } from 'lucide-react'
import { getMemberships, type OwnedBusiness, type RbacMembership } from '../api/staffApi'
import { useSpaceStore, type SpaceRole } from '../stores/spaceStore'

const CATEGORY_LABELS: Record<string, string> = {
  beauty: 'Beauty',
  sport: 'Sport',
  pet_care: 'Pet Care',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  staff: 'Staff',
}

export function SpacePicker() {
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuthStore()
  const setSpace = useSpaceStore((s) => s.setSpace)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['memberships'],
    queryFn: getMemberships,
    enabled: isAuthenticated,
  })

  function handleSelect(
    businessId: string,
    businessName: string,
    role: SpaceRole,
    locationIds: string[],
  ) {
    setSpace({ businessId, businessName, role, locationIds })
    navigate('/dashboard')
  }

  function handleOwned(biz: OwnedBusiness) {
    handleSelect(biz.business_id, biz.business_name, 'owner', [])
  }

  function handleMembership(m: RbacMembership) {
    handleSelect(m.business_id, m.business_name, m.role, m.location_ids)
  }

  if (!isAuthenticated) return null

  const total = (data?.owned.length ?? 0) + (data?.memberships.length ?? 0)

  return (
    <div className="min-h-screen bg-[#020905] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="size-10 bg-[#1069d1] rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <span className="text-white font-heading font-semibold text-xl">Bookit Business</span>
      </div>

      <div className="w-full max-w-md">
        <p className="font-heading font-semibold text-2xl text-white text-center mb-2">
          Choose a workspace
        </p>
        <p className="text-sm text-white/50 text-center mb-8">
          Select the business you want to manage
        </p>

        {isLoading && (
          <p className="text-white/40 text-center text-sm">Loading your workspaces…</p>
        )}

        {isError && (
          <p className="text-red-400 text-center text-sm">
            Failed to load workspaces. Please try again.
          </p>
        )}

        {data && total === 0 && (
          <div className="text-center text-white/40 text-sm py-8">
            <Building2 className="size-10 mx-auto mb-3 opacity-30" />
            <p>You don't have access to any business yet.</p>
            <p className="mt-1">Register a business or ask an owner to invite you.</p>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex flex-col gap-2">
            {data.owned.map((biz) => (
              <SpaceCard
                key={biz.business_id}
                name={biz.business_name}
                category={CATEGORY_LABELS[biz.category] ?? biz.category}
                role="Owner"
                isActive={biz.is_active}
                onClick={() => handleOwned(biz)}
              />
            ))}
            {data.memberships.map((m) => (
              <SpaceCard
                key={`${m.business_id}-${m.role}`}
                name={m.business_name}
                category={CATEGORY_LABELS[m.category] ?? m.category}
                role={ROLE_LABELS[m.role] ?? m.role}
                isActive={m.is_active}
                onClick={() => handleMembership(m)}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => { logout(); navigate('/') }}
          className="mt-8 w-full flex items-center justify-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors"
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </div>
  )
}

function SpaceCard({
  name,
  category,
  role,
  isActive,
  onClick,
}: {
  name: string
  category: string
  role: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-left"
    >
      <div className="size-10 bg-[#1069d1]/20 rounded-lg flex items-center justify-center shrink-0">
        <Building2 className="size-5 text-[#1069d1]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-white/40">{category}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#1069d1]/20 text-[#1069d1] font-medium">
          {role}
        </span>
        {!isActive && (
          <span className="text-xs text-white/30">Inactive</span>
        )}
      </div>
    </button>
  )
}
