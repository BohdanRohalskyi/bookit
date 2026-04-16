import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, type ApiError } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setError(null)

    const { data: result, error: apiError } = await api.POST('/api/v1/auth/login', {
      body: data,
    })

    if (apiError) {
      const err = apiError as ApiError
      setError(err.detail || err.title || 'Login failed')
      return
    }

    if (result) {
      setAuth(result.user, result.tokens)
      navigate('/spaces')
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
            Manage your business from one place
          </p>
          <p className="text-lg text-white/70 leading-relaxed">
            Bookings, clients, and scheduling — unified for sports, beauty, and pet care providers.
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
              Welcome back
            </p>
            <p className="text-base text-[rgba(2,9,5,0.6)]">
              Sign in to manage your business and bookings
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {error && (
              <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
                {error}
              </div>
            )}

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
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-[#020905]">
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                placeholder="Your password"
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
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-[rgba(2,9,5,0.6)] text-center">
            New here?{' '}
            <Link to="/register" className="text-[#1069d1] hover:underline font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
