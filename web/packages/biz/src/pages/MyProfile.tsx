import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@bookit/shared/stores'
import { useFeatureFlag } from '@bookit/shared'
import { FLAGS } from '@bookit/shared/features'
import { Loader2, User, Check } from 'lucide-react'
import { useSpaceStore } from '../stores/spaceStore'
import { getMyProfile, updateMyProfile } from '../api/staffApi'

export function MyProfile() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const businessId = useSpaceStore((s) => s.businessId)
  const queryClient = useQueryClient()
  const isEnabled = useFeatureFlag(FLAGS.STAFF_PROFILES)

  const [fullName, setFullName] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) navigate('/login')
  }, [isAuthenticated, navigate])

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['my-profile', businessId],
    queryFn: () => getMyProfile(businessId!),
    enabled: !!businessId && isEnabled,
  })

  useEffect(() => {
    if (profile) setFullName(profile.full_name)
  }, [profile])

  const update = useMutation({
    mutationFn: () => updateMyProfile(businessId!, { full_name: fullName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', businessId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (!isAuthenticated) return null

  if (!isEnabled) {
    return (
      <div className="text-center py-16 text-[rgba(2,9,5,0.4)] text-sm">
        Profile editing is not available yet.
      </div>
    )
  }

  if (!businessId) {
    return (
      <div className="text-center py-16 text-[rgba(2,9,5,0.4)] text-sm">
        No business selected.
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

      {isError && !isLoading && (
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
          <ProfileForm
            fullName={fullName}
            onChange={setFullName}
            onSave={() => update.mutate()}
            saving={update.isPending}
            saved={saved}
            error={update.isError ? ((update.error as { detail?: string })?.detail ?? 'Save failed') : null}
          />
        </div>
      )}

      {profile && (
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6">
          {/* Avatar */}
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

          <ProfileForm
            fullName={fullName}
            onChange={setFullName}
            onSave={() => update.mutate()}
            saving={update.isPending}
            saved={saved}
            error={update.isError ? ((update.error as { detail?: string })?.detail ?? 'Save failed') : null}
          />
        </div>
      )}
    </div>
  )
}

function ProfileForm({
  fullName,
  onChange,
  onSave,
  saving,
  saved,
  error,
}: {
  fullName: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error: string | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
          Full name
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your full name"
          className="w-full h-9 px-3 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 focus:border-[#1069d1]"
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={onSave}
        disabled={saving || !fullName.trim()}
        className="self-start flex items-center gap-2 h-9 px-4 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-[6px] transition-colors disabled:opacity-60"
      >
        {saving && <Loader2 className="size-3.5 animate-spin" />}
        {saved && <Check className="size-3.5" />}
        {saved ? 'Saved' : 'Save changes'}
      </button>
    </div>
  )
}
