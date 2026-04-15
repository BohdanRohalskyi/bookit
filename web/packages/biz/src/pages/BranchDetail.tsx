import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, MapPin, Phone, Mail, Clock,
  CalendarOff, ImagePlus, Trash2, AlertTriangle, Check, X,
} from 'lucide-react'
import { api, API_URL } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

type Branch = components['schemas']['Branch']
type ScheduleDay = components['schemas']['ScheduleDay']
type ScheduleException = components['schemas']['ScheduleException']
type BranchPhoto = components['schemas']['BranchPhoto']

// ─── Day labels ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ─── Schedule editor ──────────────────────────────────────────────────────────

interface LocalDay {
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
}

function ScheduleEditor({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/schedule', {
        params: { path: { id: branchId } },
      })
      return data ?? null
    },
  })

  const [days, setDays] = useState<LocalDay[] | null>(null)

  // Initialise local state once schedule loads
  const effectiveDays: LocalDay[] = days ?? (schedule?.days?.map((d: ScheduleDay) => ({
    day_of_week: d.day_of_week,
    is_open: d.is_open,
    open_time: d.open_time ?? '09:00',
    close_time: d.close_time ?? '18:00',
  })) ?? Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, is_open: false, open_time: '09:00', close_time: '18:00' })))

  const updateDay = (idx: number, patch: Partial<LocalDay>) => {
    setDays(effectiveDays.map((d, i) => i === idx ? { ...d, ...patch } : d))
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const { error } = await api.PUT('/api/v1/branches/{id}/schedule/days', {
        params: { path: { id: branchId } },
        body: {
          days: effectiveDays.map((d) => ({
            day_of_week: d.day_of_week,
            is_open: d.is_open,
            open_time: d.is_open ? d.open_time : null,
            close_time: d.is_open ? d.close_time : null,
          })),
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', branchId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading) return <div className="h-48 bg-gray-50 rounded-lg animate-pulse" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {effectiveDays.map((day, idx) => (
          <div key={day.day_of_week} className="flex items-center gap-4 py-2.5 px-4 bg-white border border-[rgba(2,9,5,0.08)] rounded-lg">
            <span className="text-sm font-medium text-[#020905] w-24 shrink-0">{DAY_LABELS[day.day_of_week]}</span>

            {/* Open toggle */}
            <button
              type="button"
              onClick={() => updateDay(idx, { is_open: !day.is_open })}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${day.is_open ? 'bg-[#1069d1]' : 'bg-[rgba(2,9,5,0.15)]'}`}
            >
              <span className={`absolute top-1 left-1 size-4 bg-white rounded-full shadow transition-transform ${day.is_open ? 'translate-x-4' : ''}`} />
            </button>

            {day.is_open ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={day.open_time}
                  onChange={(e) => updateDay(idx, { open_time: e.target.value })}
                  placeholder="09:00"
                  className="w-20 px-3 py-1.5 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
                />
                <span className="text-sm text-[rgba(2,9,5,0.4)]">–</span>
                <input
                  type="text"
                  value={day.close_time}
                  onChange={(e) => updateDay(idx, { close_time: e.target.value })}
                  placeholder="18:00"
                  className="w-20 px-3 py-1.5 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
                />
              </div>
            ) : (
              <span className="text-sm text-[rgba(2,9,5,0.35)] flex-1">Closed</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => save()}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 transition-colors"
        >
          {saved ? <Check className="size-4" /> : null}
          {isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Schedule'}
        </button>
      </div>
    </div>
  )
}

// ─── Exceptions ────────────────────────────────────────────────────────────────

function ExceptionsManager({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState('')
  const [isClosed, setIsClosed] = useState(true)
  const [openTime, setOpenTime] = useState('09:00')
  const [closeTime, setCloseTime] = useState('18:00')
  const [reason, setReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['exceptions', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/schedule/exceptions', {
        params: { path: { id: branchId } },
      })
      return (data as { data: ScheduleException[] } | null)?.data ?? []
    },
  })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST('/api/v1/branches/{id}/schedule/exceptions', {
        params: { path: { id: branchId } },
        body: {
          date,
          is_closed: isClosed,
          open_time: isClosed ? null : openTime,
          close_time: isClosed ? null : closeTime,
          reason: reason || undefined,
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions', branchId] })
      setShowForm(false)
      setDate('')
      setReason('')
      setIsClosed(true)
    },
  })

  const { mutate: remove } = useMutation({
    mutationFn: async (exceptionId: string) => {
      const { error } = await api.DELETE('/api/v1/branches/{id}/schedule/exceptions/{exception_id}', {
        params: { path: { id: branchId, exception_id: exceptionId } },
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exceptions', branchId] }),
  })

  const exceptions = data ?? []

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
      ) : exceptions.length === 0 && !showForm ? (
        <p className="text-sm text-[rgba(2,9,5,0.4)] py-4 text-center">No upcoming exceptions</p>
      ) : (
        <div className="flex flex-col gap-2">
          {exceptions.map((e: ScheduleException) => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3 bg-white border border-[rgba(2,9,5,0.08)] rounded-lg">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-[#020905]">{e.date}</p>
                <p className="text-xs text-[rgba(2,9,5,0.5)]">
                  {e.is_closed ? 'Closed' : `Open ${e.open_time} – ${e.close_time}`}
                  {e.reason ? ` · ${e.reason}` : ''}
                </p>
              </div>
              <button
                onClick={() => remove(e.id)}
                className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-4 bg-white border border-[rgba(2,9,5,0.08)] rounded-lg flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#020905]">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#020905]">Reason (optional)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Holiday, renovation…"
                className="px-3 py-2 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isClosed}
                onChange={(e) => setIsClosed(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-[#020905]">Closed all day</span>
            </label>
            {!isClosed && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-20 px-3 py-1.5 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
                />
                <span className="text-sm text-[rgba(2,9,5,0.4)]">–</span>
                <input
                  type="text"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-20 px-3 py-1.5 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => create()}
              disabled={creating || !date}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 transition-colors"
            >
              {creating ? 'Adding…' : 'Add Exception'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[rgba(2,9,5,0.6)] border border-dashed border-[rgba(2,9,5,0.2)] rounded-[6px] hover:border-[#1069d1] hover:text-[#1069d1] transition-colors w-fit"
        >
          <CalendarOff className="size-4" />
          Add exception
        </button>
      )}
    </div>
  )
}

// ─── Photo gallery ────────────────────────────────────────────────────────────

function PhotoGallery({ branchId }: { branchId: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['branch-photos', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/photos', {
        params: { path: { id: branchId } },
      })
      return (data as { data: BranchPhoto[] } | null)?.data ?? []
    },
  })

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    const formData = new FormData()
    formData.append('file', file)
    const token = useAuthStore.getState().getAccessToken()
    const res = await fetch(`${API_URL}/api/v1/branches/${branchId}/photos`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    setUploading(false)
    if (!res.ok) {
      setUploadError('Failed to upload photo. Please try again.')
    } else {
      queryClient.invalidateQueries({ queryKey: ['branch-photos', branchId] })
    }
  }

  const { mutate: deletePhoto } = useMutation({
    mutationFn: async (photoId: string) => {
      setDeletingId(photoId)
      const { error } = await api.DELETE('/api/v1/branches/{id}/photos/{photo_id}', {
        params: { path: { id: branchId, photo_id: photoId } },
      })
      if (error) throw error
    },
    onSettled: () => setDeletingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branch-photos', branchId] }),
  })

  const photos = data ?? []

  return (
    <div className="flex flex-col gap-4">
      {uploadError && (
        <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
          {uploadError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
      />

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo: BranchPhoto) => (
            <div key={photo.id} className="relative aspect-square group">
              <img
                src={photo.url}
                alt="Branch photo"
                className="w-full h-full object-cover rounded-lg border border-[rgba(2,9,5,0.08)]"
              />
              <button
                onClick={() => deletePhoto(photo.id)}
                disabled={deletingId === photo.id}
                className="absolute top-1.5 right-1.5 size-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 className="size-3 text-white" />
              </button>
            </div>
          ))}

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-lg text-[rgba(2,9,5,0.4)] hover:border-[#1069d1] hover:text-[#1069d1] transition-colors disabled:opacity-50"
          >
            <ImagePlus className="size-6" />
            <span className="text-xs font-medium">{uploading ? 'Uploading…' : 'Add photo'}</span>
          </button>
        </div>
      )}
      <p className="text-xs text-[rgba(2,9,5,0.35)]">JPEG, PNG or WebP · max 10 MB each</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[rgba(2,9,5,0.06)]">
        <Icon className="size-4 text-[rgba(2,9,5,0.4)]" />
        <p className="font-heading font-semibold text-base text-[#020905]">{title}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export function BranchDetail() {
  const { businessId, branchId } = useParams<{ businessId: string; branchId: string }>()

  const { data: branch, isLoading } = useQuery({
    queryKey: ['branch', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}', {
        params: { path: { id: branchId! } },
      })
      return (data as Branch | null)
    },
    enabled: Boolean(branchId),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
            <div className="h-16 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!branch) return null

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to={`/dashboard/businesses/${businessId}/branches`}
            className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors mb-3"
          >
            <ArrowLeft className="size-4" />
            Branches
          </Link>
          <p className="font-heading font-semibold text-2xl text-[#020905]">{branch.name}</p>
          <div className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)] mt-1">
            <MapPin className="size-3.5" />
            {branch.address}, {branch.city}
          </div>
        </div>
        <Link
          to={`/dashboard/businesses/${businessId}/branches/${branchId}/edit`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors"
        >
          <Pencil className="size-4" />
          Edit
        </Link>
      </div>

      {/* Info */}
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 grid grid-cols-2 gap-4">
        {branch.phone && (
          <div className="flex items-center gap-2 text-sm text-[rgba(2,9,5,0.6)]">
            <Phone className="size-4 shrink-0" />
            {branch.phone}
          </div>
        )}
        {branch.email && (
          <div className="flex items-center gap-2 text-sm text-[rgba(2,9,5,0.6)]">
            <Mail className="size-4 shrink-0" />
            {branch.email}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-[rgba(2,9,5,0.6)]">
          <Clock className="size-4 shrink-0" />
          {branch.timezone}
        </div>
        <div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            branch.is_active
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            {branch.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Schedule */}
      <Section title="Working Schedule" icon={Clock}>
        <ScheduleEditor branchId={branchId!} />
      </Section>

      {/* Exceptions */}
      <Section title="Schedule Exceptions" icon={AlertTriangle}>
        <ExceptionsManager branchId={branchId!} />
      </Section>

      {/* Photos */}
      <Section title="Photos" icon={ImagePlus}>
        <PhotoGallery branchId={branchId!} />
      </Section>
    </div>
  )
}
