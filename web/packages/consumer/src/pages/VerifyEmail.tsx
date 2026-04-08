import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@bookit/shared'
import { api } from '@bookit/shared/api'

type Status = 'loading' | 'success' | 'error'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  // Compute initial state based on token presence to avoid setState in effect
  const initialState = useMemo(() => {
    if (!token) {
      return { status: 'error' as Status, error: 'Invalid verification link' }
    }
    return { status: 'loading' as Status, error: null }
  }, [token])

  const [status, setStatus] = useState<Status>(initialState.status)
  const [error, setError] = useState<string | null>(initialState.error)

  useEffect(() => {
    if (!token) {
      return
    }

    const verify = async () => {
      const { error: apiError } = await api.POST('/api/v1/auth/verify-email', {
        body: { token },
      })

      if (apiError) {
        const err = apiError as { detail?: string; title?: string }
        setStatus('error')
        setError(err.detail || err.title || 'Verification failed')
        return
      }

      setStatus('success')
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="text-2xl font-semibold text-primary mb-4 block">
            Bookit
          </Link>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Verifying...'}
            {status === 'success' && 'Email Verified'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'loading' && (
            <p className="text-muted-foreground">Please wait while we verify your email...</p>
          )}

          {status === 'success' && (
            <>
              <p className="text-green-600">Your email has been verified successfully!</p>
              <Link to="/account" className="text-primary hover:underline block">
                Go to your account
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-red-500">{error}</p>
              <Link to="/account" className="text-primary hover:underline block">
                Go to your account
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
