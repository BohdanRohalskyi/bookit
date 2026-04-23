import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, MapPin, Calendar, X } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import { ServiceCard, ServiceCardSkeleton } from '../components/ServiceCard'

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

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: '',         label: 'All' },
  { value: 'beauty',   label: 'Beauty' },
  { value: 'sport',    label: 'Sport' },
  { value: 'pet_care', label: 'Pet care' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SearchPage() {
  const [params, setParams] = useSearchParams()

  const q        = params.get('q')        ?? ''
  const category = params.get('category') ?? ''
  const city     = params.get('city')     ?? ''
  const date     = params.get('date')     ?? ''
  const page     = Math.max(1, Number(params.get('page') ?? '1'))

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['services/search', q, category, city, date, page],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/services/search', {
        params: {
          query: {
            q: q || undefined,
            category: (category || undefined) as 'beauty' | 'sport' | 'pet_care' | undefined,
            city: city || undefined,
            date: date || undefined,
            page,
            per_page: 20,
          },
        },
      })
      if (error) throw error
      return data
    },
  })

  const results    = data?.data        ?? []
  const pagination = data?.pagination

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* ── Search header ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#f0f7ff] to-white border-b border-slate-100">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10">
          <p className="font-heading font-semibold text-3xl text-slate-900 mb-6">
            Find a service
          </p>

          {/* Keyword */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search services, e.g. haircut, yoga, dog grooming…"
              value={q}
              onChange={e => set('q', e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1069d1] transition-colors text-sm shadow-sm"
            />
            {q && (
              <button
                onClick={() => set('q', '')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* City + Date */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={e => set('city', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1069d1] transition-colors text-sm shadow-sm"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={date}
                onChange={e => set('date', e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#1069d1] transition-colors text-sm shadow-sm w-full sm:w-auto"
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => set('category', cat.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  category === cat.value
                    ? 'bg-[#1069d1] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-[#1069d1] hover:text-[#1069d1]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-8">
        {!isLoading && (
          <p className="text-sm text-slate-500 mb-5">
            {pagination?.total ?? 0}{' '}
            {pagination?.total === 1 ? 'service' : 'services'} found
          </p>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4 text-center">
            <span className="text-5xl">🔍</span>
            <p className="font-heading font-semibold text-xl text-slate-900">No services found</p>
            <p className="text-slate-500 text-sm max-w-[320px]">
              Try adjusting your filters or search for something different.
            </p>
            <button
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="mt-2 px-5 py-2.5 text-sm font-medium text-[#1069d1] border border-[#1069d1] rounded-xl hover:bg-blue-50 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {results.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => set('page', String(page - 1))}
              disabled={page <= 1}
              className="px-5 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page} of {pagination.total_pages}
            </span>
            <button
              onClick={() => set('page', String(page + 1))}
              disabled={page >= pagination.total_pages}
              className="px-5 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
