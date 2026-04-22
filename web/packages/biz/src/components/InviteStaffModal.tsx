import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Mail } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useFeatureFlag } from '@bookit/shared'
import { inviteMember } from '../api/staffApi'

interface Props {
  businessId: string
  onClose: () => void
}

const INPUT_CLASS =
  'w-full h-9 px-3 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 focus:border-[#1069d1] bg-white'

export function InviteStaffModal({ businessId, onClose }: Props) {
  const queryClient = useQueryClient()
  const jobTitlesEnabled = useFeatureFlag('STAFF_JOB_TITLES_INVITE')

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Legacy (flag off): role toggle
  const [role, setRole] = useState<'administrator' | 'staff'>('staff')

  const { data: locationsData } = useQuery({
    queryKey: ['locations', businessId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/locations', {
        params: { query: { business_id: businessId } },
      })
      return data ?? null
    },
    enabled: jobTitlesEnabled,
  })

  const { data: staffRolesData, isLoading: staffRolesLoading } = useQuery({
    queryKey: ['staff-roles', businessId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/staff-roles', {
        params: { query: { business_id: businessId } },
      })
      return data ?? null
    },
    enabled: jobTitlesEnabled,
  })

  const locations = locationsData?.data ?? []
  const staffRoles = staffRolesData?.data ?? []

  const isAdminSelected = staffRoles
    .filter((sr) => selectedRoleIds.includes(sr.id))
    .some((sr) => sr.role === 'administrator')

  const invite = useMutation({
    mutationFn: () => {
      if (jobTitlesEnabled) {
        return inviteMember(businessId, {
          email,
          full_name: fullName,
          staff_role_ids: selectedRoleIds,
          location_id: selectedLocationId || null,
        })
      }
      // Legacy path — kept while flag is off
      return inviteMember(businessId, {
        email,
        full_name: fullName,
        staff_role_ids: [role],
        location_id: null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', businessId] })
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { detail?: string }
      setError(e?.detail ?? 'Failed to send invite. Please try again.')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (jobTitlesEnabled && selectedRoleIds.length === 0) {
      setError('Please select at least one job title.')
      return
    }
    invite.mutate()
  }

  function toggleRole(id: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="size-9 bg-[#e7f0fa] rounded-lg flex items-center justify-center">
              <Mail className="size-4 text-[#1069d1]" />
            </div>
            <p className="font-heading font-semibold text-[#020905] text-base">Invite team member</p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-[rgba(2,9,5,0.05)] transition-colors"
          >
            <X className="size-4 text-[rgba(2,9,5,0.4)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full name */}
          <div>
            <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
              Full name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className={INPUT_CLASS}
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className={INPUT_CLASS}
            />
          </div>

          {jobTitlesEnabled ? (
            <>
              {/* Location selector */}
              <div>
                <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
                  Location{' '}
                  <span className="text-[rgba(2,9,5,0.35)] font-normal">(optional)</span>
                </label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">All locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job titles multi-select */}
              <div>
                <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
                  Job titles
                </label>
                {staffRolesLoading && (
                  <p className="text-xs text-[rgba(2,9,5,0.4)]">Loading…</p>
                )}
                {!staffRolesLoading && staffRoles.length === 0 && (
                  <p className="text-xs text-[rgba(2,9,5,0.4)] italic">
                    No job titles yet — create them in Location settings first.
                  </p>
                )}
                {staffRoles.length > 0 && (
                  <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto border border-[rgba(2,9,5,0.15)] rounded-[6px] p-2">
                    {staffRoles.map((sr) => (
                      <label
                        key={sr.id}
                        className="flex items-center gap-2.5 text-sm cursor-pointer px-1.5 py-1 rounded hover:bg-[rgba(2,9,5,0.03)] select-none"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(sr.id)}
                          onChange={() => toggleRole(sr.id)}
                          className="accent-[#1069d1] size-3.5 shrink-0"
                        />
                        <span className="text-[#020905] flex-1">{sr.job_title}</span>
                        {sr.is_system && (
                          <span className="text-[10px] text-[rgba(2,9,5,0.35)] font-medium uppercase tracking-wide">
                            {sr.role}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {selectedRoleIds.length > 0 && (
                  <p className="mt-1.5 text-xs text-[rgba(2,9,5,0.4)]">
                    {isAdminSelected
                      ? 'Can manage locations, staff, services, equipment and bookings.'
                      : 'Can view their own bookings and location details.'}
                  </p>
                )}
              </div>
            </>
          ) : (
            /* Legacy role toggle (flag off) */
            <div>
              <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
                Role
              </label>
              <div className="flex gap-2">
                {(['administrator', 'staff'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 h-9 rounded-[6px] text-sm font-medium border transition-colors capitalize ${
                      role === r
                        ? 'bg-[#1069d1] border-[#1069d1] text-white'
                        : 'border-[rgba(2,9,5,0.15)] text-[rgba(2,9,5,0.6)] hover:border-[rgba(2,9,5,0.3)]'
                    }`}
                  >
                    {r === 'administrator' ? 'Administrator' : 'Staff'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[rgba(2,9,5,0.4)]">
                {role === 'administrator'
                  ? 'Can manage locations, staff, services, equipment and bookings.'
                  : 'Can view their own bookings and location details.'}
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 border border-[rgba(2,9,5,0.15)] rounded-[6px] text-sm text-[rgba(2,9,5,0.6)] hover:border-[rgba(2,9,5,0.3)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={invite.isPending || (jobTitlesEnabled && selectedRoleIds.length === 0)}
              className="flex-1 h-9 flex items-center justify-center gap-2 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-[6px] transition-colors disabled:opacity-60"
            >
              {invite.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
