import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@bookit/shared/api'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  address: z.string().min(1, 'Address is required').max(200),
  city: z.string().min(1, 'City is required').max(100),
  country: z.string().min(1, 'Country is required').max(100),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  timezone: z.string().optional(),
  is_active: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BranchForm() {
  const { businessId, branchId } = useParams<{ businessId: string; branchId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(branchId)
  const [apiError, setApiError] = useState<string | null>(null)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['branch', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}', {
        params: { path: { id: branchId! } },
      })
      return data ?? null
    },
    enabled: isEdit,
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
        is_active: existing.is_active,
      })
    }
  }, [existing, reset])

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isEdit && branchId) {
        const { error } = await api.PUT('/api/v1/branches/{id}', {
          params: { path: { id: branchId } },
          body: {
            name: values.name,
            address: values.address,
            city: values.city,
            country: values.country,
            phone: values.phone || undefined,
            email: values.email || undefined,
            timezone: values.timezone || undefined,
            is_active: values.is_active,
          },
        })
        if (error) throw error
      } else {
        const { error } = await api.POST('/api/v1/branches', {
          body: {
            business_id: businessId!,
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', businessId] })
      if (isEdit && branchId) {
        queryClient.invalidateQueries({ queryKey: ['branch', branchId] })
      }
      navigate(`/dashboard/businesses/${businessId}/branches`)
    },
    onError: () => setApiError('Failed to save branch. Please try again.'),
  })

  if (isEdit && loadingExisting) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8 animate-pulse">
          <div className="h-5 bg-gray-100 rounded w-1/3 mb-8" />
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        <Link
          to={`/dashboard/businesses/${businessId}/branches`}
          className="flex items-center gap-1.5 text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors"
        >
          <ArrowLeft className="size-4" />
          Branches
        </Link>
        <span className="text-[rgba(2,9,5,0.2)]">/</span>
        <span className="text-[#020905] font-medium">{isEdit ? 'Edit Branch' : 'Add Branch'}</span>
      </div>

      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8">
        <p className="font-heading font-semibold text-xl text-[#020905] mb-1">
          {isEdit ? 'Edit Branch' : 'Add a New Branch'}
        </p>
        <p className="text-sm text-[rgba(2,9,5,0.45)] mb-8">
          {isEdit ? 'Update branch information' : 'Set up a physical branch where clients can book appointments'}
        </p>

        {apiError && (
          <div className="mb-6 px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
            {apiError}
          </div>
        )}

        <form
          onSubmit={handleSubmit((v) => { setApiError(null); mutate(v) })}
          className="flex flex-col gap-5"
        >
          {/* Name */}
          <Field label="Branch name" required error={errors.name?.message}>
            <input
              {...register('name')}
              placeholder="e.g. Main Street Studio"
              className={inputCls}
            />
          </Field>

          {/* Address */}
          <Field label="Address" required error={errors.address?.message}>
            <input {...register('address')} placeholder="e.g. Gedimino pr. 1" className={inputCls} />
          </Field>

          {/* City + Country */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" required error={errors.city?.message}>
              <input {...register('city')} placeholder="Vilnius" className={inputCls} />
            </Field>
            <Field label="Country" required error={errors.country?.message}>
              <input {...register('country')} placeholder="Lithuania" className={inputCls} />
            </Field>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} placeholder="+37061234567" className={inputCls} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register('email')} type="email" placeholder="branch@example.com" className={inputCls} />
            </Field>
          </div>

          {/* Timezone */}
          <Field label="Timezone" error={errors.timezone?.message}>
            <input {...register('timezone')} placeholder="Europe/Vilnius" className={inputCls} />
          </Field>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div className="flex items-center justify-between py-3 px-4 bg-[#f8f9fa] rounded-[6px]">
              <div>
                <p className="text-sm font-medium text-[#020905]">Active</p>
                <p className="text-xs text-[rgba(2,9,5,0.45)] mt-0.5">Inactive branches won't accept bookings</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="sr-only peer" />
                <div className="w-10 h-6 bg-[rgba(2,9,5,0.15)] peer-checked:bg-[#1069d1] rounded-full transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Branch'}
            </button>
            <Link
              to={`/dashboard/businesses/${businessId}/branches`}
              className="px-6 py-2.5 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-4 py-3 text-sm text-[#020905] placeholder:text-[rgba(2,9,5,0.35)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors'

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
