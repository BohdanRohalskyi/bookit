import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { api, API_URL } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

type LocationPhoto = components['schemas']['LocationPhoto']

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  address: z.string().min(1, 'Address is required').max(200),
  city: z.string().min(1, 'City is required').max(100),
  country: z.string().min(1, 'Country is required').max(100),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  timezone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Photo gallery ────────────────────────────────────────────────────────────

function PhotoGallery({ locationId }: { locationId: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['location-photos', locationId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/locations/{id}/photos', {
        params: { path: { id: locationId } },
      })
      return (data as { data: LocationPhoto[] } | null)?.data ?? []
    },
  })

  const handleUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const token = useAuthStore.getState().getAccessToken()
    await fetch(`${API_URL}/api/v1/locations/${locationId}/photos`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    setUploading(false)
    queryClient.invalidateQueries({ queryKey: ['location-photos', locationId] })
  }

  const { mutate: deletePhoto } = useMutation({
    mutationFn: async (photoId: string) => {
      setDeletingId(photoId)
      await api.DELETE('/api/v1/locations/{id}/photos/{photo_id}', {
        params: { path: { id: locationId, photo_id: photoId } },
      })
    },
    onSettled: () => setDeletingId(null),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['location-photos', locationId] }),
  })

  const photos = data ?? []

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
        }}
      />
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo: LocationPhoto) => (
          <div key={photo.id} className="relative aspect-square group">
            <img
              src={photo.url}
              alt="Location photo"
              className="w-full h-full object-cover rounded-lg border border-[rgba(2,9,5,0.08)]"
            />
            <button
              onClick={() => deletePhoto(photo.id)}
              disabled={deletingId === photo.id}
              className="absolute top-1.5 right-1.5 size-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
              <Trash2 className="size-3 text-white" />
            </button>
          </div>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="aspect-square flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-lg text-[rgba(2,9,5,0.4)] hover:border-[#1069d1] hover:text-[#1069d1] transition-colors disabled:opacity-50"
        >
          <ImagePlus className="size-5" />
          <span className="text-xs font-medium">{uploading ? 'Uploading…' : 'Add'}</span>
        </button>
      </div>
      <p className="text-xs text-[rgba(2,9,5,0.35)]">JPEG, PNG or WebP · max 10 MB</p>
    </div>
  )
}

// ─── Step ─────────────────────────────────────────────────────────────────────

interface Props {
  businessId: string
  locationId: string | null
  onSaved: (locationId: string) => void
}

const inputCls =
  'w-full px-4 py-3 text-sm text-[#020905] placeholder:text-[rgba(2,9,5,0.35)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors'

export function StepBasicInfo({ businessId, locationId, onSaved }: Props) {
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(locationId)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['location', locationId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/locations/{id}', {
        params: { path: { id: locationId! } },
      })
      return data ?? null
    },
    enabled: Boolean(locationId),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'Lithuania', timezone: 'Europe/Vilnius' },
  })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        address: existing.address,
        city: existing.city,
        country: existing.country,
        phone: existing.phone ?? '',
        email: existing.email ?? '',
        timezone: existing.timezone ?? 'Europe/Vilnius',
      })
    }
  }, [existing, reset])

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      if (locationId) {
        const { data, error } = await api.PUT('/api/v1/locations/{id}', {
          params: { path: { id: locationId } },
          body: {
            name: values.name,
            address: values.address,
            city: values.city,
            country: values.country,
            phone: values.phone || undefined,
            email: values.email || undefined,
            timezone: values.timezone || undefined,
          },
        })
        if (error) throw error
        return data!.id
      } else {
        const { data, error } = await api.POST('/api/v1/locations', {
          body: {
            business_id: businessId,
            name: values.name,
            address: values.address,
            city: values.city,
            country: values.country,
            phone: values.phone || undefined,
            email: values.email || undefined,
            timezone: values.timezone || 'Europe/Vilnius',
          },
        })
        if (error) throw error
        return data!.id
      }
    },
    onSuccess: (id) => {
      setSavedId(id ?? locationId ?? null)
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      queryClient.invalidateQueries({ queryKey: ['location', id ?? locationId] })
    },
    onError: () => setApiError('Failed to save location. Please try again.'),
  })

  if (locationId && loadingExisting) {
    return (
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-6" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded mb-4" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8">
        <p className="font-heading font-semibold text-lg text-[#020905] mb-6">Basic Information</p>

        {apiError && (
          <div className="mb-6 px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
            {apiError}
          </div>
        )}

        <form
          onSubmit={handleSubmit((v) => { setApiError(null); mutate(v) })}
          className="flex flex-col gap-5"
        >
          <Field label="Location name" required error={errors.name?.message}>
            <input {...register('name')} placeholder="e.g. Main Street Studio" className={inputCls} />
          </Field>

          <Field label="Address" required error={errors.address?.message}>
            <input {...register('address')} placeholder="e.g. Gedimino pr. 1" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City" required error={errors.city?.message}>
              <input {...register('city')} placeholder="Vilnius" className={inputCls} />
            </Field>
            <Field label="Country" required error={errors.country?.message}>
              <input {...register('country')} placeholder="Lithuania" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} placeholder="+37061234567" className={inputCls} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register('email')} type="email" placeholder="location@example.com" className={inputCls} />
            </Field>
          </div>

          <Field label="Timezone">
            <input {...register('timezone')} placeholder="Europe/Vilnius" className={inputCls} />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Saving…' : savedId ? 'Save Changes' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>

      {/* Photos section */}
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8">
        <p className="font-heading font-semibold text-lg text-[#020905] mb-1">Photos</p>
        <p className="text-sm text-[rgba(2,9,5,0.45)] mb-5">
          Add photos of your location to attract clients
        </p>
        {savedId ? (
          <PhotoGallery locationId={savedId} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 border-2 border-dashed border-[rgba(2,9,5,0.1)] rounded-lg">
            <p className="text-sm text-[rgba(2,9,5,0.35)]">
              Save the location details above to start uploading photos
            </p>
          </div>
        )}
      </div>

      {/* Continue button */}
      {savedId && (
        <div className="flex justify-end">
          <button
            onClick={() => onSaved(savedId)}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
          >
            Continue to Schedule →
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, error, children }: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#020905]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
