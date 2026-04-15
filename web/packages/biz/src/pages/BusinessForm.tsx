import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Scissors, Dumbbell, PawPrint } from 'lucide-react'
import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'

type BusinessCategory = components['schemas']['BusinessCategory']

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z
    .string()
    .min(1, 'Business name is required')
    .max(100, 'Max 100 characters'),
  category: z.enum(['beauty', 'sport', 'pet_care'], {
    errorMap: () => ({ message: 'Please select a category' }),
  }),
  description: z
    .string()
    .max(1000, 'Max 1000 characters')
    .optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Category options ─────────────────────────────────────────────────────────

const categories: {
  value: BusinessCategory
  label: string
  description: string
  icon: React.ElementType
}[] = [
  {
    value: 'beauty',
    label: 'Beauty',
    description: 'Salons, barbers, spas, nail studios',
    icon: Scissors,
  },
  {
    value: 'sport',
    label: 'Sport',
    description: 'Gyms, studios, trainers, courts',
    icon: Dumbbell,
  },
  {
    value: 'pet_care',
    label: 'Pet Care',
    description: 'Vets, groomers, sitters, trainers',
    icon: PawPrint,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BusinessForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const selectedCategory = watch('category')

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data, error } = await api.POST('/api/v1/businesses', {
        body: {
          name: values.name,
          category: values.category,
          ...(values.description ? { description: values.description } : {}),
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      navigate('/dashboard/businesses')
    },
    onError: () => {
      setApiError('Failed to create business. Please try again.')
    },
  })

  const onSubmit = (values: FormValues) => {
    setApiError(null)
    mutate(values)
  }

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
        <p className="font-heading font-semibold text-xl text-[#020905] mb-1">
          Add a New Business
        </p>
        <p className="text-sm text-[rgba(2,9,5,0.45)] mb-8">
          Set up your business profile to start accepting bookings from clients
        </p>

        {apiError && (
          <div className="mb-6 px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
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
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
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
                    onClick={() =>
                      setValue('category', cat.value, { shouldValidate: true })
                    }
                    className={`flex flex-col items-start gap-2 px-4 py-4 text-left border-2 rounded-[6px] transition-colors ${
                      isSelected
                        ? 'border-[#1069d1] bg-[#e7f0fa]'
                        : 'border-[rgba(2,9,5,0.15)] hover:border-[rgba(2,9,5,0.3)]'
                    }`}
                  >
                    <Icon
                      className={`size-5 ${
                        isSelected ? 'text-[#1069d1]' : 'text-[rgba(2,9,5,0.4)]'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-[#020905]">{cat.label}</p>
                      <p className="text-xs text-[rgba(2,9,5,0.5)] leading-relaxed mt-0.5">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            {errors.category && (
              <p className="text-xs text-red-600">{errors.category.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">
              Description{' '}
              <span className="text-[rgba(2,9,5,0.4)] font-normal">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              placeholder="Tell clients what your business offers, your specialties, and what sets you apart…"
              rows={4}
              className="w-full px-4 py-3 text-sm text-[#020905] placeholder:text-[rgba(2,9,5,0.35)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors resize-none"
            />
            {errors.description && (
              <p className="text-xs text-red-600">{errors.description.message}</p>
            )}
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
