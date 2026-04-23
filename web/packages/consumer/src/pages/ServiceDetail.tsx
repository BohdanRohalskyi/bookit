import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, Banknote, MapPin, Building2 } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="font-heading font-semibold text-lg text-slate-900">
          Bookit
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              <span className="text-sm text-slate-500 hidden md:block">{user.name}</span>
              <Link to="/account">
                <button className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-lg hover:bg-[#0d56b0] transition-colors">
                  My account
                </button>
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                  Log in
                </button>
              </Link>
              <Link to="/register">
                <button className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-lg hover:bg-[#0d56b0] transition-colors">
                  Sign up free
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  beauty:   { label: 'Beauty',   className: 'bg-rose-50 text-rose-600 border border-rose-100' },
  sport:    { label: 'Sport',    className: 'bg-blue-50 text-blue-600 border border-blue-100' },
  pet_care: { label: 'Pet care', className: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  beauty:   '💇',
  sport:    '🏃',
  pet_care: '🐾',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="h-16 bg-white border-b border-slate-100" />
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-8">
        <div className="h-4 bg-slate-100 rounded w-24 mb-8" />
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="h-56 bg-slate-100" />
          <div className="p-8 flex flex-col gap-4">
            <div className="h-7 bg-slate-100 rounded w-1/2" />
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-12 bg-slate-100 rounded w-40 mt-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['service', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/services/{id}', {
        params: { path: { id: id! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(id),
  })

  if (isLoading) return <Skeleton />

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-24 flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">😕</span>
          <p className="font-heading font-semibold text-xl text-slate-900">Service not found</p>
          <p className="text-slate-500 text-sm">This service may have been removed or is no longer available.</p>
          <Link to="/search">
            <button className="mt-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors">
              Back to search
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const badge = CATEGORY_BADGE[data.category]

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-8">
        {/* Back link */}
        <Link
          to="/search"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to search
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {/* Cover image */}
          <div className="h-56 bg-slate-100 flex items-center justify-center overflow-hidden">
            {data.cover_image_url ? (
              <img
                src={data.cover_image_url}
                alt={data.business_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-6xl">
                {CATEGORY_EMOJI[data.category] ?? '📅'}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-heading font-semibold text-2xl text-slate-900 mb-1">
                  {data.name}
                </p>
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Building2 className="size-4" />
                  <span>{data.business_name}</span>
                  {data.city && (
                    <>
                      <span className="text-slate-300">·</span>
                      <MapPin className="size-4" />
                      <span>{data.city}</span>
                    </>
                  )}
                </div>
              </div>
              {badge && (
                <span className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>

            {data.description && (
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                {data.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 py-5 border-t border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="size-4 text-slate-400" />
                <span className="text-sm font-medium">{data.duration_minutes} min</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Banknote className="size-4 text-slate-400" />
                <span className="text-sm font-medium">
                  €{Number(data.price).toFixed(2)} {data.currency}
                </span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => navigate(`/book/${id}`)}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors"
            >
              Book now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
