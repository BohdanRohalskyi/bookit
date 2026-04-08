import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@bookit/shared'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'

export function Account() {
  const navigate = useNavigate()
  const { user, logout, tokens } = useAuthStore()
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleResendVerification = async () => {
    setResendStatus('sending')

    const { error } = await api.POST('/api/v1/auth/resend-verification', {
      headers: {
        Authorization: `Bearer ${tokens?.accessToken}`,
      },
    })

    if (error) {
      setResendStatus('error')
      return
    }

    setResendStatus('sent')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-primary">
            Bookit
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Account</h1>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="font-medium">{user?.name}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="font-medium">{user?.phone || '—'}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm text-muted-foreground">Email Verified</span>
                <div className="flex items-center gap-3">
                  {user?.email_verified ? (
                    <span className="text-green-600 font-medium">Yes</span>
                  ) : (
                    <>
                      <span className="text-yellow-600 font-medium">No</span>
                      {resendStatus === 'idle' && (
                        <Button variant="outline" size="sm" onClick={handleResendVerification}>
                          Resend verification email
                        </Button>
                      )}
                      {resendStatus === 'sending' && (
                        <span className="text-sm text-muted-foreground">Sending...</span>
                      )}
                      {resendStatus === 'sent' && (
                        <span className="text-sm text-green-600">Verification email sent!</span>
                      )}
                      {resendStatus === 'error' && (
                        <span className="text-sm text-red-500">Failed to send. Try again later.</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Created</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-muted-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </span>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
