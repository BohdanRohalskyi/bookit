import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@bookit/shared/stores'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { getInvite, acceptInvite } from '../api/staffApi'

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  staff: 'Staff',
}

export function InviteAccept() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { isAuthenticated } = useAuthStore()

  const { data: invite, isLoading, isError, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => getInvite(token),
    enabled: !!token,
    retry: false,
  })

  const accept = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: () => navigate('/spaces'),
  })

  function handleAccept() {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/invites?token=${token}`)}`)
      return
    }
    accept.mutate()
  }

  if (!token) {
    return <ErrorScreen message="Invalid invite link." />
  }

  return (
    <div className="min-h-screen bg-[#020905] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="size-10 bg-[#1069d1] rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <span className="text-white font-heading font-semibold text-xl">Bookit Business</span>
      </div>

      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading invite…
          </div>
        )}

        {isError && (
          <ErrorBlock
            message={
              (error as { detail?: string })?.detail ??
              'This invite link is invalid or has expired.'
            }
          />
        )}

        {accept.isSuccess && (
          <div className="text-center">
            <CheckCircle className="size-12 text-green-400 mx-auto mb-4" />
            <p className="font-heading font-semibold text-white text-lg mb-1">You're in!</p>
            <p className="text-white/50 text-sm">Redirecting to your workspaces…</p>
          </div>
        )}

        {invite && !accept.isSuccess && (
          <>
            <p className="font-heading font-semibold text-white text-xl text-center mb-1">
              You've been invited
            </p>
            <p className="text-white/50 text-sm text-center mb-6">
              Join <strong className="text-white">{invite.business_name}</strong> as{' '}
              <strong className="text-white">
                {ROLE_LABELS[invite.role] ?? invite.role}
              </strong>
            </p>

            {accept.isError && (
              <p className="text-red-400 text-xs text-center mb-4">
                {(accept.error as { detail?: string })?.detail ??
                  'Failed to accept invite. Please try again.'}
              </p>
            )}

            <button
              onClick={handleAccept}
              disabled={accept.isPending}
              className="w-full flex items-center justify-center gap-2 h-10 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {accept.isPending && <Loader2 className="size-4 animate-spin" />}
              {isAuthenticated ? 'Accept Invitation' : 'Log in to accept'}
            </button>

            <button
              onClick={() => navigate('/')}
              className="mt-3 w-full text-center text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              Decline
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="text-center">
      <AlertCircle className="size-10 text-red-400 mx-auto mb-3" />
      <p className="text-white/70 text-sm">{message}</p>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#020905] flex items-center justify-center">
      <p className="text-white/40 text-sm">{message}</p>
    </div>
  )
}
