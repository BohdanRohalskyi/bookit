import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  TriangleAlert,
  Phone,
  Building2,
  ArrowUpRight,
} from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import { useAppSwitch } from '@bookit/shared/hooks'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

interface ProfileCardProps {
  resendStatus: 'idle' | 'sending' | 'sent' | 'error'
  onResend: () => void
}

function ProfileCard({ resendStatus, onResend }: ProfileCardProps) {
  const { user } = useAuthStore()
  const { switchTo } = useAppSwitch()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'

  if (!user) return null

  return (
    <div className="bg-white border border-[rgba(2,9,5,0.15)] rounded-lg p-8 flex flex-col gap-6">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-20 rounded-full bg-[#e7f0fa] flex items-center justify-center shrink-0">
          <span className="text-2xl font-semibold text-[#1069d1]">{getInitials(user.name)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-heading font-semibold text-2xl text-[#020905]">{user.name}</p>
          <p className="text-sm text-[rgba(2,9,5,0.6)]">{user.email}</p>
        </div>
      </div>

      {/* Email verification */}
      <div className="flex flex-col items-center gap-2">
        {user.email_verified ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
            <CheckCircle2 className="size-3.5" />
            Verified
          </span>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
              <TriangleAlert className="size-3.5" />
              Unverified
            </span>
            {resendStatus === 'idle' && (
              <button
                onClick={onResend}
                className="text-sm text-[#1069d1] hover:underline transition-colors"
              >
                Resend verification email
              </button>
            )}
            {resendStatus === 'sending' && (
              <p className="text-sm text-[rgba(2,9,5,0.6)]">Sending…</p>
            )}
            {resendStatus === 'sent' && (
              <p className="text-sm text-green-700">Verification email sent!</p>
            )}
            {resendStatus === 'error' && (
              <p className="text-sm text-red-600">Failed to send. Try again later.</p>
            )}
          </div>
        )}
      </div>

      {/* Phone */}
      {user.phone && (
        <div className="flex items-center justify-center gap-2 text-sm text-[rgba(2,9,5,0.6)]">
          <Phone className="size-4 shrink-0" />
          <span>{user.phone}</span>
        </div>
      )}

      <div className="border-t border-[rgba(2,9,5,0.1)]" />

      {/* Account type */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[rgba(2,9,5,0.6)]">Account type</p>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#e7f0fa] text-[#1069d1] text-xs font-medium">
          Provider
        </span>
      </div>

      {/* Switch to client app */}
      <button
        onClick={() => switchTo(consumerUrl)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors"
      >
        <ArrowUpRight className="size-4" />
        Go to client app
      </button>
    </div>
  )
}

// ─── Account Details Card ─────────────────────────────────────────────────────

function AccountDetailsCard() {
  const { user } = useAuthStore()
  if (!user) return null

  const rows = [
    { label: 'Full name', value: user.name },
    { label: 'Email', value: user.email },
    { label: 'Phone', value: user.phone || '—' },
  ]

  return (
    <div className="bg-white border border-[rgba(2,9,5,0.15)] rounded-lg p-8 flex flex-col gap-6">
      <p className="font-heading font-semibold text-lg text-[#020905]">Account details</p>
      <div className="flex flex-col">
        {rows.map((row, i) => (
          <div key={row.label}>
            {i > 0 && <div className="border-t border-[rgba(2,9,5,0.08)]" />}
            <div className="flex flex-col gap-1 py-4">
              <p className="text-xs font-medium text-[rgba(2,9,5,0.4)] uppercase tracking-wider">
                {row.label}
              </p>
              <p className="text-sm text-[#020905]">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/profile"
          className="px-4 py-2 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors"
        >
          Edit profile
        </Link>
      </div>
    </div>
  )
}

// ─── Business Card ────────────────────────────────────────────────────────────

function BusinessCard() {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.15)] rounded-lg p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="font-heading font-semibold text-lg text-[#020905]">Your businesses</p>
        <Link
          to="/dashboard/businesses"
          className="text-sm text-[#1069d1] hover:underline font-medium"
        >
          Manage
        </Link>
      </div>

      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Building2 className="size-10 text-[rgba(2,9,5,0.2)]" strokeWidth={1.5} />
        <div className="flex flex-col gap-1">
          <p className="font-heading font-semibold text-base text-[#020905]">
            Set up your business
          </p>
          <p className="text-sm text-[rgba(2,9,5,0.6)] max-w-[300px]">
            Add your business details to start accepting bookings
          </p>
        </div>
      </div>

      <Link
        to="/dashboard/businesses/new"
        className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
      >
        Add business
      </Link>
    </div>
  )
}

// ─── Security Card ────────────────────────────────────────────────────────────

function SecurityCard() {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.15)] rounded-lg p-8 flex flex-col gap-6">
      <p className="font-heading font-semibold text-lg text-[#020905]">Security</p>
      <div className="border-t border-[rgba(2,9,5,0.08)]" />
      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-[#020905]">Password</p>
          <p className="text-xs text-[rgba(2,9,5,0.4)]">Last changed: unknown</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled
            className="px-4 py-2 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] opacity-50 cursor-not-allowed"
          >
            Change password
          </button>
          <p className="text-xs text-[rgba(2,9,5,0.4)]">Coming soon</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Account() {
  const { tokens } = useAuthStore()
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleResendVerification = async () => {
    setResendStatus('sending')
    const { error } = await api.POST('/api/v1/auth/resend-verification', {
      headers: { Authorization: `Bearer ${tokens?.accessToken}` },
    })
    setResendStatus(error ? 'error' : 'sent')
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <p className="font-heading font-semibold text-2xl text-[#020905]">My Account</p>
        <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1">
          Manage your profile and account settings
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1">
          <ProfileCard resendStatus={resendStatus} onResend={handleResendVerification} />
        </div>
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AccountDetailsCard />
          <BusinessCard />
          <SecurityCard />
        </div>
      </div>
    </div>
  )
}
