import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Trash2, Loader2, Mail } from 'lucide-react'
import { listMembers, removeMember, type Member } from '../api/staffApi'
import { useSpaceStore } from '../stores/spaceStore'
import { useMyRole } from '../hooks/useMyRole'
import { InviteStaffModal } from '../components/InviteStaffModal'

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  staff: 'Staff',
}

const ROLE_COLORS: Record<string, string> = {
  administrator: 'bg-blue-50 text-blue-700 border-blue-200',
  staff: 'bg-gray-100 text-gray-600 border-gray-200',
}

export function StaffList() {
  const businessId = useSpaceStore((s) => s.businessId)
  const { isOwner, isAdmin } = useMyRole()
  const [showInvite, setShowInvite] = useState(false)
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

  const members = data?.data ?? []
  const active = members.filter((m) => m.status === 'active')
  const pending = members.filter((m) => m.status === 'pending')

  if (!businessId) {
    return (
      <div className="text-center py-16 text-[rgba(2,9,5,0.4)] text-sm">
        No business selected.
      </div>
    )
  }

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

      {/* Empty */}
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
        <InviteStaffModal businessId={businessId} onClose={() => setShowInvite(false)} />
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

      {/* Role badge */}
      <span
        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
          ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-600 border-gray-200'
        }`}
      >
        {ROLE_LABELS[member.role] ?? member.role}
      </span>

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
