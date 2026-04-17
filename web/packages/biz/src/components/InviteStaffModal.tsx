import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Mail } from 'lucide-react'
import { inviteMember } from '../api/staffApi'

interface Props {
  businessId: string
  onClose: () => void
}

export function InviteStaffModal({ businessId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'administrator' | 'staff'>('staff')
  const [error, setError] = useState<string | null>(null)

  const invite = useMutation({
    mutationFn: () => inviteMember(businessId, { email, full_name: fullName, role }),
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
    invite.mutate()
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
              className="w-full h-9 px-3 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 focus:border-[#1069d1]"
            />
          </div>

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
              className="w-full h-9 px-3 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 focus:border-[#1069d1]"
            />
          </div>

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
              disabled={invite.isPending}
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
