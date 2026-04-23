import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Banknote, ArrowLeft } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

type Booking = components['schemas']['Booking']
type BookingStatus = components['schemas']['BookingStatus']

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed:             { label: 'Confirmed',  className: 'bg-blue-50 text-blue-600 border border-blue-100' },
  completed:             { label: 'Completed',  className: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  cancelled_by_customer: { label: 'Cancelled',  className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  cancelled_by_provider: { label: 'Cancelled',  className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  pending_payment:       { label: 'Pending',    className: 'bg-amber-50 text-amber-600 border border-amber-100' },
  no_show:               { label: 'No show',    className: 'bg-red-50 text-red-500 border border-red-100' },
}

const FILTERS: { label: string; status?: BookingStatus }[] = [
  { label: 'All' },
  { label: 'Upcoming',  status: 'confirmed' },
  { label: 'Completed', status: 'completed' },
  { label: 'Cancelled', status: 'cancelled_by_customer' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: Booking }) {
  const firstItem = booking.items[0]
  const badge = STATUS_BADGE[booking.status] ?? { label: booking.status, className: 'bg-slate-100 text-slate-500' }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:border-slate-200 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-semibold text-slate-900 text-base">
            {firstItem?.service?.name ?? 'Booking'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">ID: {booking.id.slice(0, 8)}…</p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {firstItem && (
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4 text-slate-400" />
            {formatDate(firstItem.start_datetime)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-slate-400" />
            {formatTime(firstItem.start_datetime)} · {firstItem.duration_minutes} min
          </span>
          <span className="flex items-center gap-1.5">
            <Banknote className="size-4 text-slate-400" />
            €{Number(booking.total_amount).toFixed(2)}
          </span>
        </div>
      )}

      {booking.notes && (
        <p className="text-sm text-slate-400 italic border-t border-slate-50 pt-3">"{booking.notes}"</p>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BookingCardSkeleton() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-5 bg-slate-100 rounded w-1/3" />
        <div className="h-5 bg-slate-100 rounded w-20" />
      </div>
      <div className="flex gap-4">
        <div className="h-4 bg-slate-100 rounded w-32" />
        <div className="h-4 bg-slate-100 rounded w-24" />
        <div className="h-4 bg-slate-100 rounded w-16" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyBookings() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [activeFilter, setActiveFilter] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, navigate])

  const selectedStatus = FILTERS[activeFilter]?.status

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings', selectedStatus],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/bookings', {
        params: {
          query: {
            status: selectedStatus,
            per_page: 50,
          },
        },
      })
      if (error) throw error
      return data
    },
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) return null

  const bookings = data?.data ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[800px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-heading font-semibold text-lg text-slate-900">Bookit</Link>
          <Link to="/search" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Find services
          </Link>
        </div>
      </nav>

      <div className="max-w-[800px] mx-auto px-6 py-10">
        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          My account
        </Link>

        <p className="font-heading font-semibold text-2xl text-slate-900 mb-6">My bookings</p>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setActiveFilter(i)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeFilter === i
                  ? 'bg-[#1069d1] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-[#1069d1] hover:text-[#1069d1]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => <BookingCardSkeleton key={i} />)}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 text-center">
            <span className="text-5xl">📅</span>
            <p className="font-heading font-semibold text-xl text-slate-900">No bookings yet</p>
            <p className="text-slate-500 text-sm max-w-[280px]">
              When you book a service it will appear here.
            </p>
            <Link to="/search">
              <button className="mt-2 px-6 py-2.5 text-sm font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors">
                Browse services
              </button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {bookings.map(b => <BookingCard key={b.id} booking={b} />)}
          </div>
        )}
      </div>
    </div>
  )
}
