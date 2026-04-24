import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, type ApiError } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type RegisterForm = z.infer<typeof registerSchema>

const isAlpha = import.meta.env.VITE_ALPHA_TEST === 'true'

export function Register() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAlpha) navigate('/alpha-test', { replace: true })
  }, [navigate])

  if (isAlpha) return null

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setError(null)

    const { data: result, error: apiError } = await api.POST('/api/v1/auth/register', {
      body: data,
    })

    if (apiError) {
      const err = apiError as ApiError
      setError(err.detail || err.title || 'Registration failed')
      return
    }

    if (result) {
      setAuth(result.user, result.tokens)
      // Biz app always registers users as providers — 409 means already a provider, both are fine
      await api.POST('/api/v1/providers', {})
      navigate('/account')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#030213] to-[#0d1a3a] flex-col justify-between p-12">
        <Link to="/" className="text-white font-heading font-semibold text-lg">
          Bookit Business
        </Link>
        <div className="flex flex-col gap-6">
          <p className="font-heading font-semibold text-[48px] leading-[1.2] tracking-[-0.48px] text-white">
            Start growing your business today
          </p>
          <p className="text-lg text-white/70 leading-relaxed">
            Join providers across sports, beauty, and pet care who've simplified their bookings and
            are spending more time on what matters.
          </p>
        </div>
        <p className="text-sm text-white/40">
          &copy; {new Date().getFullYear()} Bookit. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-[400px] flex flex-col gap-8">
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden text-[#020905] font-heading font-semibold text-lg">
            Bookit Business
          </Link>

          <div className="flex flex-col gap-2">
            <p className="font-heading font-semibold text-[36px] leading-[1.2] tracking-[-0.36px] text-[#020905]">
              Get started
            </p>
            <p className="text-base text-[rgba(2,9,5,0.6)]">
              Build your business profile and start booking
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {error && (
              <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-[#020905]">
                Full name
              </label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                {...register('name')}
                className="w-full px-4 py-3 text-base text-[#020905] placeholder:text-[rgba(2,9,5,0.4)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-[#020905]">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                className="w-full px-4 py-3 text-base text-[#020905] placeholder:text-[rgba(2,9,5,0.4)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-medium text-[#020905]">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+37061234567"
                {...register('phone')}
                className="w-full px-4 py-3 text-base text-[#020905] placeholder:text-[rgba(2,9,5,0.4)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors"
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-[#020905]">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Min 8 characters"
                {...register('password')}
                className="w-full px-4 py-3 text-base text-[#020905] placeholder:text-[rgba(2,9,5,0.4)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors"
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 text-base font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-[rgba(2,9,5,0.6)] text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-[#1069d1] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
