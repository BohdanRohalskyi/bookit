import { useRef, useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Scissors, Dumbbell, PawPrint, ImagePlus, X } from 'lucide-react'
import { api, API_URL } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

type BusinessCategory = components['schemas']['BusinessCategory']

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Business name is required').max(100, 'Max 100 characters'),
  category: z.enum(['beauty', 'sport', 'pet_care'], { message: 'Please select a category' }),
  description: z.string().max(1000, 'Max 1000 characters').optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Category options ─────────────────────────────────────────────────────────

const categories: { value: BusinessCategory; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'beauty', label: 'Beauty', description: 'Salons, barbers, spas, nail studios', icon: Scissors },
  { value: 'sport', label: 'Sport', description: 'Gyms, studios, trainers, courts', icon: Dumbbell },
  { value: 'pet_care', label: 'Pet Care', description: 'Vets, groomers, sitters, trainers', icon: PawPrint },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BusinessForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)
  const [logoWarning, setLogoWarning] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revoke blob URL on cleanup to avoid memory leaks
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const selectedCategory = watch('category')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const removeFile = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      // Step 1: create the business
      const { data, error } = await api.POST('/api/v1/businesses', {
        body: {
          name: values.name,
          category: values.category,
          ...(values.description ? { description: values.description } : {}),
        },
      })
      if (error) throw error
      if (!data) throw new Error('No data returned')

      // Step 2: upload logo if selected (non-fatal — business was created regardless)
      if (logoFile) {
        const formData = new FormData()
        formData.append('file', logoFile)
        const token = useAuthStore.getState().getAccessToken()
        const res = await fetch(`${API_URL}/api/v1/businesses/${data.id}/logo`, {
          method: 'POST',
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) {
          return { ...data, logoFailed: true }
        }
      }

      return { ...data, logoFailed: false }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      if ('logoFailed' in data && data.logoFailed) {
        setLogoWarning('Business created, but the logo could not be uploaded. You can add it later from the edit menu.')
        return
      }
      navigate('/dashboard/businesses')
    },
    onError: () => {
      setApiError('Failed to create business. Please try again.')
    },
  })

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        <Link
          to="/dashboard/businesses"
          className="flex items-center gap-1.5 text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors"
        >
          <ArrowLeft className="size-4" />
          Businesses
        </Link>
        <span className="text-[rgba(2,9,5,0.2)]">/</span>
        <span className="text-[#020905] font-medium">Add Business</span>
      </div>

      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8">
        <p className="font-heading font-semibold text-xl text-[#020905] mb-1">Add a New Business</p>
        <p className="text-sm text-[rgba(2,9,5,0.45)] mb-8">
          Set up your business profile to start accepting bookings from clients
        </p>

        {apiError && (
          <div className="mb-6 px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
            {apiError}
          </div>
        )}

        {logoWarning && (
          <div className="mb-6 px-4 py-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-[6px] flex flex-col gap-3">
            <p>{logoWarning}</p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/businesses')}
              className="self-start text-xs font-medium text-amber-700 underline"
            >
              Go to businesses →
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit((v) => { setApiError(null); mutate(v) })} className="flex flex-col gap-6">

          {/* Logo */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">
              Logo <span className="text-[rgba(2,9,5,0.4)] font-normal">(optional)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            {logoPreview ? (
              <div className="relative size-24">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="size-24 rounded-lg object-cover border-2 border-[rgba(2,9,5,0.15)]"
                />
                <button
                  type="button"
                  onClick={removeFile}
                  className="absolute -top-2 -right-2 size-5 bg-[#020905] rounded-full flex items-center justify-center"
                >
                  <X className="size-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 text-sm text-[rgba(2,9,5,0.5)] border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-[6px] hover:border-[#1069d1] hover:text-[#1069d1] transition-colors w-fit"
              >
                <ImagePlus className="size-4" />
                Upload logo
              </button>
            )}
            <p className="text-xs text-[rgba(2,9,5,0.35)]">JPEG, PNG or WebP · max 5 MB</p>
          </div>

          {/* Business name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">
              Business name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              placeholder="e.g. Glow Beauty Studio"
              className="w-full px-4 py-3 text-sm text-[#020905] placeholder:text-[rgba(2,9,5,0.35)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors"
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => {
                const Icon = cat.icon
                const isSelected = selectedCategory === cat.value
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setValue('category', cat.value, { shouldValidate: true })}
                    className={`flex flex-col items-start gap-2 px-4 py-4 text-left border-2 rounded-[6px] transition-colors ${
                      isSelected
                        ? 'border-[#1069d1] bg-[#e7f0fa]'
                        : 'border-[rgba(2,9,5,0.15)] hover:border-[rgba(2,9,5,0.3)]'
                    }`}
                  >
                    <Icon className={`size-5 ${isSelected ? 'text-[#1069d1]' : 'text-[rgba(2,9,5,0.4)]'}`} />
                    <div>
                      <p className="text-sm font-medium text-[#020905]">{cat.label}</p>
                      <p className="text-xs text-[rgba(2,9,5,0.5)] leading-relaxed mt-0.5">{cat.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {errors.category && <p className="text-xs text-red-600">{errors.category.message}</p>}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">
              Description <span className="text-[rgba(2,9,5,0.4)] font-normal">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              placeholder="Tell clients what your business offers, your specialties, and what sets you apart…"
              rows={4}
              className="w-full px-4 py-3 text-sm text-[#020905] placeholder:text-[rgba(2,9,5,0.35)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors resize-none"
            />
            {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Creating…' : 'Create Business'}
            </button>
            <Link
              to="/dashboard/businesses"
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
