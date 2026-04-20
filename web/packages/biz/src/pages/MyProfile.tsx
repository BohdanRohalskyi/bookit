import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFeatureFlag } from '@bookit/shared'
import { Loader2, User, Check } from 'lucide-react'
import { useSpaceStore } from '../stores/spaceStore'
import { getMyProfile, updateMyProfile, type MemberProfile } from '../api/staffApi'

export function MyProfile() {
  const businessId = useSpaceStore((s) => s.businessId)
  const isEnabled = useFeatureFlag('STAFF_PROFILES')

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['my-profile', businessId],
    queryFn: () => getMyProfile(businessId!),
    enabled: !!businessId && isEnabled,
  })

  if (!isEnabled) {
    return (
      <div className="text-center py-16 text-[rgba(2,9,5,0.4)] text-sm">
        Profile editing is not available yet.
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <p className="font-heading font-semibold text-xl text-[#020905]">My profile</p>
        <p className="text-sm text-[rgba(2,9,5,0.5)] mt-0.5">
          Your name and photo as they appear to others in this business
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-[rgba(2,9,5,0.4)]">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Loading profile…</span>
        </div>
      )}

      {/* No profile yet — show empty form */}
      {isError && !isLoading && businessId && (
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-14 bg-[#e7f0fa] rounded-full flex items-center justify-center">
              <User className="size-6 text-[#1069d1]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#020905]">No profile yet</p>
              <p className="text-xs text-[rgba(2,9,5,0.5)]">Create your business profile below</p>
            </div>
          </div>
          {/* key prop ensures fresh state when businessId changes */}
          <EditableProfile key={businessId} businessId={businessId} defaultName="" />
        </div>
      )}

      {/* Profile loaded — show avatar + editable form */}
      {profile && (
        <ProfileCard key={profile.id} businessId={businessId!} profile={profile} />
      )}
    </div>
  )
}

// ─── Profile card (mounted only when profile data exists) ─────────────────────

function ProfileCard({ businessId, profile }: { businessId: string; profile: MemberProfile }) {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="size-14 bg-[#e7f0fa] rounded-full flex items-center justify-center shrink-0">
          {profile.photo_url ? (
            <img
              src={profile.photo_url}
              alt={profile.full_name}
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <span className="text-lg font-semibold text-[#1069d1]">
              {profile.full_name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-[#020905]">{profile.full_name}</p>
          <p className="text-xs text-[rgba(2,9,5,0.4)]">
            Updated {new Date(profile.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      {/* key=profile.id so state resets if profile changes */}
      <EditableProfile key={profile.id} businessId={businessId} defaultName={profile.full_name} />
    </div>
  )
}

// ─── Editable name form ───────────────────────────────────────────────────────
// Receives defaultName once on mount — avoids setState-in-effect pattern.

function EditableProfile({ businessId, defaultName }: { businessId: string; defaultName: string }) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState(defaultName)
  const [saved, setSaved] = useState(false)

  const update = useMutation({
    mutationFn: () => updateMyProfile(businessId, { full_name: fullName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', businessId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
          Full name
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="w-full h-9 px-3 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 focus:border-[#1069d1]"
        />
      </div>

      {update.isError && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {(update.error as { detail?: string })?.detail ?? 'Save failed'}
        </p>
      )}

      <button
        onClick={() => update.mutate()}
        disabled={update.isPending || !fullName.trim()}
        className="self-start flex items-center gap-2 h-9 px-4 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-[6px] transition-colors disabled:opacity-60"
      >
        {update.isPending && <Loader2 className="size-3.5 animate-spin" />}
        {saved && <Check className="size-3.5" />}
        {saved ? 'Saved' : 'Save changes'}
      </button>
    </div>
  )
}
