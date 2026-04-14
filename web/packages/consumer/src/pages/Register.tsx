import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@bookit/shared'
import { api, type ApiError } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import { useAppSwitch } from '@bookit/shared/hooks'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
})

type RegisterForm = z.infer<typeof registerSchema>
type AccountType = 'customer' | 'provider'

export function Register() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const { switchTo } = useAppSwitch()
  const [accountType, setAccountType] = useState<AccountType>('customer')
  const [error, setError] = useState<string | null>(null)

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

      if (accountType === 'provider') {
        await api.POST('/api/v1/providers', {})
        const bizUrl = import.meta.env.VITE_BIZ_URL || 'https://pt-duo-bookit-biz.web.app'
        await switchTo(bizUrl)
        return
      }

      navigate('/account')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="text-2xl font-semibold text-primary mb-4 block">
            Bookit
          </Link>

          <div className="flex rounded-lg border border-border p-1 mb-2">
            <button
              type="button"
              onClick={() => setAccountType('customer')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                accountType === 'customer'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => setAccountType('provider')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                accountType === 'provider'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Provider
            </button>
          </div>

          <CardTitle className="text-2xl">
            {accountType === 'customer' ? 'Create Account' : 'Start offering services'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+37061234567"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 8 characters"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
