import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, Clock, Star } from 'lucide-react'
import { Button, Input, Label } from '@bookit/shared'
import { api, type ApiError } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>
type AccountType = 'customer' | 'provider'

// ─── Branded left panel ───────────────────────────────────────────────────────

function HeroPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-[#1069d1] p-12 text-white">
      <Link to="/" className="font-heading font-semibold text-2xl">
        Bookit
      </Link>

      <div className="flex flex-col gap-6">
        <p className="font-heading font-semibold text-[40px] leading-[1.15] tracking-[-0.5px]">
          Your next appointment is two taps away
        </p>
        <p className="text-blue-100 text-lg leading-relaxed max-w-[360px]">
          Beauty, sport & pet care — book instantly with real-time availability.
        </p>

        <div className="flex flex-col gap-3 mt-2">
          {[
            { icon: Calendar, text: 'Real-time availability' },
            { icon: Clock,    text: 'Instant confirmation' },
            { icon: Star,     text: '4.9 rating from 600+ reviews' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Icon className="size-4" strokeWidth={1.8} />
              </div>
              <span className="text-sm text-blue-50">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-blue-200 text-xs">
        &copy; {new Date().getFullYear()} Bookit. Available in Lithuania.
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [accountType, setAccountType] = useState<AccountType>('customer')
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
      navigate('/account')
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[480px_1fr] bg-slate-50">
      <HeroPanel />

      {/* ── Right: form ── */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] flex flex-col gap-8">

          {/* Mobile logo */}
          <Link to="/" className="lg:hidden font-heading font-semibold text-2xl text-[#1069d1]">
            Bookit
          </Link>

          {/* Header */}
          <div className="flex flex-col gap-1">
            <p className="font-heading font-semibold text-[28px] text-slate-900">Welcome back</p>
            <p className="text-slate-500 text-sm">Sign in to your account to continue.</p>
          </div>

          {/* Account type tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(['customer', 'provider'] as AccountType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  accountType === type
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type === 'customer' ? 'Customer' : 'Provider'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="h-11 rounded-xl border-slate-200 focus:border-[#1069d1] focus:ring-[#1069d1]/20"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#1069d1] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-11 rounded-xl border-slate-200 focus:border-[#1069d1] focus:ring-[#1069d1]/20"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl bg-[#1069d1] hover:bg-[#0d56b0] text-white font-medium transition-colors"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#1069d1] font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
