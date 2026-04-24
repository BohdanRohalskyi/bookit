import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, TriangleAlert, Phone, Mail, User, CalendarDays, ChevronRight } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

function formatMemberSince(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-slate-100 rounded-lg animate-pulse ${className ?? ''}`}
    />
  )
}

function AccountSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-6 items-start">
      {/* Left skeleton */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 flex flex-col items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      {/* Right skeleton */}
      <div className="flex flex-col gap-6">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 flex flex-col gap-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 flex flex-col gap-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-900">{value || '—'}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Account() {
  const navigate = useNavigate()
  const { user, logout, tokens, isAuthenticated } = useAuthStore()
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

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

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[900px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-heading font-semibold text-lg text-slate-900">
            Bookit
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 max-w-[900px] mx-auto w-full px-6 py-12">
        {user === null ? (
          <AccountSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-6 items-start">

            {/* ── Left: Profile card ── */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 flex flex-col items-center gap-5 text-center">
              {/* Avatar */}
              <div className="size-20 rounded-full bg-[#e8f0fc] flex items-center justify-center shrink-0">
                <span className="text-2xl font-semibold text-[#1069d1]">
                  {getInitials(user.name)}
                </span>
              </div>

              {/* Name + email */}
              <div className="flex flex-col gap-1">
                <p className="font-heading font-semibold text-2xl text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>

              {/* Email verification badge */}
              {user.email_verified ? (
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-100">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  Email verified
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-100">
                    <TriangleAlert className="size-3.5 shrink-0" />
                    Email not verified
                  </div>
                  {resendStatus === 'idle' && (
                    <button
                      onClick={handleResendVerification}
                      className="text-sm text-[#1069d1] hover:underline transition-colors"
                    >
                      Resend verification
                    </button>
                  )}
                  {resendStatus === 'sending' && (
                    <span className="text-sm text-slate-400">Sending…</span>
                  )}
                  {resendStatus === 'sent' && (
                    <span className="text-sm text-emerald-600">Verification email sent!</span>
                  )}
                  {resendStatus === 'error' && (
                    <span className="text-sm text-red-500">Failed to send. Try again later.</span>
                  )}
                </div>
              )}

              {/* Phone (if present) */}
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="size-4 shrink-0 text-slate-400" />
                  {user.phone}
                </div>
              )}

              <div className="w-full border-t border-slate-100 my-1" />

              {/* Member since */}
              <div className="flex flex-col gap-1 text-center">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Member since</span>
                <span className="text-sm text-slate-900">{formatMemberSince(user.created_at)}</span>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="flex flex-col gap-6">

              {/* My bookings quick-access */}
              <Link
                to="/bookings"
                className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 flex items-center justify-between gap-4 hover:border-[#1069d1] hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-[#e8f0fc] flex items-center justify-center shrink-0">
                    <CalendarDays className="size-5 text-[#1069d1]" strokeWidth={1.8} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="font-heading font-semibold text-base text-slate-900">My bookings</p>
                    <p className="text-sm text-slate-500">View and manage your appointments</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-slate-400 group-hover:text-[#1069d1] transition-colors shrink-0" />
              </Link>

              {/* Personal information card */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 flex flex-col gap-6">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-slate-400 shrink-0" />
                  <p className="font-heading font-semibold text-lg text-slate-900">Personal information</p>
                </div>

                <div className="flex flex-col gap-5">
                  <InfoRow label="Full name" value={user.name} />
                  <div className="border-t border-slate-100" />
                  <InfoRow label="Email" value={user.email} />
                  <div className="border-t border-slate-100" />
                  <InfoRow label="Phone" value={user.phone ?? '—'} />
                </div>

                <button
                  disabled
                  className="mt-2 self-start px-4 py-2 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl opacity-50 cursor-not-allowed"
                  title="Coming soon"
                >
                  Edit profile — coming soon
                </button>
              </div>

              {/* Security card */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 flex flex-col gap-6">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-slate-400 shrink-0" />
                  <p className="font-heading font-semibold text-lg text-slate-900">Security</p>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Password</span>
                      <span className="text-sm text-slate-900 tracking-widest">••••••••</span>
                    </div>
                    <button
                      disabled
                      className="px-4 py-2 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl opacity-50 cursor-not-allowed"
                      title="Coming soon"
                    >
                      Change password
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}
