import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@bookit/shared'
import { api, type AuthResponse } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'

export function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { data: result, error: apiError } = await api.POST('/api/v1/auth/login', {
      body: { email, password },
    })

    setIsSubmitting(false)

    if (apiError) {
      const err = apiError as { detail?: string; title?: string }
      setError(err.detail || err.title || 'Login failed')
      return
    }

    if (result) {
      const authResult = result as AuthResponse
      setAuth(authResult.user, authResult.tokens)
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="text-2xl font-semibold text-primary mb-4 block">
            Bookit Business
          </Link>
          <CardTitle className="text-2xl">Business Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have a business account?{' '}
            <a href={consumerUrl} className="text-primary hover:underline">
              Register on Client App
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
