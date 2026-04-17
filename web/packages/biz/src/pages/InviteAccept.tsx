import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '@bookit/shared/stores'
import { CheckCircle, AlertCircle, Loader2, Building2 } from 'lucide-react'
import {
  getInvite,
  registerAndAcceptInvite,
  loginAndAcceptInvite,
  type InvitePreview,
} from '../api/staffApi'

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  staff: 'Staff',
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    full_name: z.string().min(1, 'Full name is required').max(255),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

type RegisterForm = z.infer<typeof registerSchema>
type LoginForm = z.infer<typeof loginSchema>

// ─── Main page ────────────────────────────────────────────────────────────────

export function InviteAccept() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const { data: invite, isLoading, isError, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => getInvite(token),
    enabled: !!token,
    retry: false,
  })

  if (!token) {
    return <Shell><ErrorBlock message="Invalid invite link." /></Shell>
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 text-white/40 text-sm py-8">
          <Loader2 className="size-4 animate-spin" />
          Loading invite…
        </div>
      </Shell>
    )
  }

  if (isError) {
    const err = error as { detail?: string; title?: string }
    return (
      <Shell>
        <ErrorBlock message={err?.detail ?? err?.title ?? 'This invite link is invalid or has expired.'} />
      </Shell>
    )
  }

  if (!invite) return null

  return (
    <Shell>
      <InviteCard token={token} invite={invite} />
    </Shell>
  )
}

// ─── Invite card (branching on user_exists) ───────────────────────────────────

function InviteCard({ token, invite }: { token: string; invite: InvitePreview }) {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [done, setDone] = useState(false)

  function onSuccess(result: RegisterAndAcceptResult) {
    setAuth(result.user, result.tokens)
    setDone(true)
    setTimeout(() => navigate('/spaces'), 1500)
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="size-12 text-green-400 mx-auto mb-4" />
        <p className="font-heading font-semibold text-white text-lg mb-1">You're in!</p>
        <p className="text-white/50 text-sm">Taking you to your workspace…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Invite summary */}
      <div className="text-center">
        <div className="size-12 bg-[#1069d1]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="size-6 text-[#1069d1]" />
        </div>
        <p className="font-heading font-semibold text-white text-xl mb-1">
          You've been invited
        </p>
        <p className="text-white/50 text-sm">
          Join <span className="text-white font-medium">{invite.business_name}</span> as{' '}
          <span className="text-white font-medium">{ROLE_LABELS[invite.role] ?? invite.role}</span>
        </p>
        {invite.full_name && (
          <p className="text-white/40 text-xs mt-1">Invite for {invite.full_name}</p>
        )}
      </div>

      <div className="border-t border-white/10" />

      {invite.user_exists ? (
        <LoginForm token={token} email={invite.email} onSuccess={onSuccess} />
      ) : (
        <RegisterForm
          token={token}
          email={invite.email}
          prefillName={invite.full_name ?? ''}
          onSuccess={onSuccess}
        />
      )}
    </div>
  )
}

// ─── Register form (new users) ────────────────────────────────────────────────

function RegisterForm({
  token,
  email,
  prefillName,
  onSuccess,
}: {
  token: string
  email: string
  prefillName: string
  onSuccess: (result: RegisterAndAcceptResult) => void
}) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: prefillName },
  })

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) =>
      registerAndAcceptInvite(token, { password: data.password, full_name: data.full_name }),
    onSuccess,
    onError: (err: unknown) => {
      const e = err as { detail?: string; title?: string }
      setApiError(e?.detail ?? e?.title ?? 'Something went wrong. Please try again.')
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => { setApiError(null); mutation.mutate(d) })} className="flex flex-col gap-4">
      <p className="text-white/70 text-sm text-center">Create your account to accept</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Full name</label>
        <input
          type="text"
          {...register('full_name')}
          className="w-full h-10 px-3 text-sm bg-white/10 border border-white/15 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#1069d1] transition-colors"
          placeholder="Your full name"
        />
        {errors.full_name && <p className="text-xs text-red-400">{errors.full_name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Email</label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full h-10 px-3 text-sm bg-white/5 border border-white/10 rounded-lg text-white/40 cursor-not-allowed"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Password</label>
        <input
          type="password"
          {...register('password')}
          className="w-full h-10 px-3 text-sm bg-white/10 border border-white/15 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#1069d1] transition-colors"
          placeholder="Min 8 characters"
        />
        {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Confirm password</label>
        <input
          type="password"
          {...register('confirm_password')}
          className="w-full h-10 px-3 text-sm bg-white/10 border border-white/15 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#1069d1] transition-colors"
          placeholder="Repeat your password"
        />
        {errors.confirm_password && (
          <p className="text-xs text-red-400">{errors.confirm_password.message}</p>
        )}
      </div>

      {apiError && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {apiError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="w-full h-10 flex items-center justify-center gap-2 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
      >
        {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
        Create account & join
      </button>
    </form>
  )
}

// ─── Login form (existing users) ──────────────────────────────────────────────

function LoginForm({
  token,
  email,
  onSuccess,
}: {
  token: string
  email: string
  onSuccess: (result: RegisterAndAcceptResult) => void
}) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const mutation = useMutation({
    mutationFn: (data: LoginForm) => loginAndAcceptInvite(token, email, data.password),
    onSuccess,
    onError: (err: unknown) => {
      const e = err as { detail?: string; title?: string }
      setApiError(e?.detail ?? e?.title ?? 'Invalid password. Please try again.')
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => { setApiError(null); mutation.mutate(d) })} className="flex flex-col gap-4">
      <p className="text-white/70 text-sm text-center">
        You already have a Bookit account. Log in to accept.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Email</label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full h-10 px-3 text-sm bg-white/5 border border-white/10 rounded-lg text-white/40 cursor-not-allowed"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-white/50">Password</label>
        <input
          type="password"
          {...register('password')}
          className="w-full h-10 px-3 text-sm bg-white/10 border border-white/15 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-[#1069d1] transition-colors"
          placeholder="Your password"
          autoFocus
        />
        {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
      </div>

      {apiError && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {apiError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="w-full h-10 flex items-center justify-center gap-2 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
      >
        {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
        Log in & accept
      </button>
    </form>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020905] flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-3 mb-10">
        <div className="size-10 bg-[#1069d1] rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <span className="text-white font-heading font-semibold text-xl">Bookit Business</span>
      </div>
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8">
        {children}
      </div>
    </div>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="text-center py-4">
      <AlertCircle className="size-10 text-red-400 mx-auto mb-3" />
      <p className="text-white/70 text-sm">{message}</p>
    </div>
  )
}
