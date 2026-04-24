import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Trash2, Loader2, Mail, MapPin, ChevronDown } from 'lucide-react'
import { listMembers, removeMember, type Member } from '../api/staffApi'
import { useSpaceStore } from '../stores/spaceStore'
import { useMyRole } from '../hooks/useMyRole'
import { InviteStaffModal } from '../components/InviteStaffModal'

export function StaffList() {
  const businessId = useSpaceStore((s) => s.businessId)
  const { isOwner, isAdmin } = useMyRole()
  const [showInvite, setShowInvite] = useState(false)
  const [jobTitleFilter, setJobTitleFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['members', businessId],
    queryFn: () => listMembers(businessId!),
    enabled: !!businessId,
  })

  const remove = useMutation({
    mutationFn: (memberId: string) => removeMember(businessId!, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', businessId] }),
  })

  const members = useMemo(() => data?.data ?? [], [data])

  // Collect unique filter options from all members
  const allJobTitles = useMemo(() => {
    const set = new Set<string>()
    members.forEach((m) => m.job_titles?.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [members])

  const allLocations = useMemo(() => {
    const set = new Set<string>()
    members.forEach((m) => { if (m.location_name) set.add(m.location_name) })
    return Array.from(set).sort()
  }, [members])

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesJob = !jobTitleFilter || m.job_titles?.includes(jobTitleFilter)
      const matchesLoc = !locationFilter || m.location_name === locationFilter
      return matchesJob && matchesLoc
    })
  }, [members, jobTitleFilter, locationFilter])

  const active = filtered.filter((m) => m.status === 'active')
  const pending = filtered.filter((m) => m.status === 'pending')
  const hasFilters = !!jobTitleFilter || !!locationFilter

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-heading font-semibold text-xl text-[#020905]">Team</p>
          <p className="text-sm text-[rgba(2,9,5,0.5)] mt-0.5">
            Manage your business team members
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 h-9 px-4 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-[6px] transition-colors"
          >
            <UserPlus className="size-4" />
            Invite member
          </button>
        )}
      </div>

      {/* Filters */}
      {(allJobTitles.length > 0 || allLocations.length > 0) && (
        <div className="flex flex-wrap gap-3 mb-5">
          {allJobTitles.length > 0 && (
            <div className="relative">
              <select
                value={jobTitleFilter}
                onChange={(e) => setJobTitleFilter(e.target.value)}
                className={`appearance-none h-8 pl-3 pr-8 text-sm rounded-[6px] border transition-colors focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 ${
                  jobTitleFilter
                    ? 'border-[#1069d1] bg-[#e7f0fa] text-[#1069d1] font-medium'
                    : 'border-[rgba(2,9,5,0.15)] bg-white text-[rgba(2,9,5,0.6)]'
                }`}
              >
                <option value="">All job titles</option>
                {allJobTitles.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-[rgba(2,9,5,0.4)] pointer-events-none" />
            </div>
          )}

          {allLocations.length > 0 && (
            <div className="relative">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className={`appearance-none h-8 pl-3 pr-8 text-sm rounded-[6px] border transition-colors focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 ${
                  locationFilter
                    ? 'border-[#1069d1] bg-[#e7f0fa] text-[#1069d1] font-medium'
                    : 'border-[rgba(2,9,5,0.15)] bg-white text-[rgba(2,9,5,0.6)]'
                }`}
              >
                <option value="">All locations</option>
                {allLocations.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-[rgba(2,9,5,0.4)] pointer-events-none" />
            </div>
          )}

          {hasFilters && (
            <button
              onClick={() => { setJobTitleFilter(''); setLocationFilter('') }}
              className="h-8 px-3 text-sm text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-[rgba(2,9,5,0.4)]">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-16 text-sm text-[rgba(2,9,5,0.4)]">
          Failed to load team members.
        </div>
      )}

      {/* Empty — no members at all */}
      {!isLoading && !isError && members.length === 0 && (
        <div className="text-center py-16">
          <Users className="size-10 mx-auto mb-3 text-[rgba(2,9,5,0.15)]" />
          <p className="text-[rgba(2,9,5,0.5)] text-sm">No team members yet.</p>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="mt-4 text-[#1069d1] text-sm hover:underline"
            >
              Invite your first team member
            </button>
          )}
        </div>
      )}

      {/* Empty — filters returned nothing */}
      {!isLoading && !isError && members.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-[rgba(2,9,5,0.4)]">
          No members match the selected filters.
        </div>
      )}

      {/* Active members */}
      {active.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-[rgba(2,9,5,0.4)] uppercase tracking-wider mb-3">
            Active members ({active.length})
          </p>
          <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg divide-y divide-[rgba(2,9,5,0.06)]">
            {active.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canRemove={isOwner || isAdmin}
                removing={remove.isPending}
                onRemove={() => remove.mutate(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[rgba(2,9,5,0.4)] uppercase tracking-wider mb-3">
            Pending invites ({pending.length})
          </p>
          <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg divide-y divide-[rgba(2,9,5,0.06)]">
            {pending.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canRemove={isOwner || isAdmin}
                removing={remove.isPending}
                onRemove={() => remove.mutate(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteStaffModal businessId={businessId!} onClose={() => setShowInvite(false)} />
      )}
    </div>
  )
}

function MemberRow({
  member,
  canRemove,
  removing,
  onRemove,
}: {
  member: Member
  canRemove: boolean
  removing: boolean
  onRemove: () => void
}) {
  const initials = member.name
    ? member.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
    : member.email.slice(0, 2).toUpperCase()

  const jobTitles = member.job_titles ?? []

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Avatar */}
      <div className="size-9 bg-[#e7f0fa] rounded-full flex items-center justify-center shrink-0">
        {member.status === 'pending' ? (
          <Mail className="size-4 text-[#1069d1]" />
        ) : (
          <span className="text-xs font-semibold text-[#1069d1]">{initials}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {member.name && (
          <p className="text-sm font-medium text-[#020905] truncate">{member.name}</p>
        )}
        <p className="text-xs text-[rgba(2,9,5,0.5)] truncate">{member.email}</p>
      </div>

      {/* Location */}
      {member.location_name && (
        <div className="hidden sm:flex items-center gap-1 text-xs text-[rgba(2,9,5,0.45)] shrink-0">
          <MapPin className="size-3 shrink-0" />
          <span className="max-w-[120px] truncate">{member.location_name}</span>
        </div>
      )}

      {/* Job title badges (replaces role badge) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {jobTitles.length > 0 ? (
          <>
            {jobTitles.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-full border bg-[#e7f0fa] text-[#1069d1] border-[rgba(16,105,209,0.2)] font-medium"
              >
                {t}
              </span>
            ))}
            {jobTitles.length > 2 && (
              <span className="text-xs text-[rgba(2,9,5,0.4)]">+{jobTitles.length - 2}</span>
            )}
          </>
        ) : (
          // Fallback to role if no job titles assigned yet
          <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200 font-medium capitalize">
            {member.role}
          </span>
        )}
      </div>

      {/* Status badge for pending */}
      {member.status === 'pending' && (
        <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
          Pending
        </span>
      )}

      {/* Remove button */}
      {canRemove && (
        <button
          onClick={onRemove}
          disabled={removing}
          className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          title="Remove member"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}
