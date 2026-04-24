import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, Banknote, ArrowLeft, X } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

type Booking = components['schemas']['Booking']
type BookingStatus = components['schemas']['BookingStatus']
type TimeSlot = components['schemas']['TimeSlot']

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed:             { label: 'Confirmed',  className: 'bg-blue-50 text-blue-600 border border-blue-100' },
  completed:             { label: 'Completed',  className: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  cancelled_by_customer: { label: 'Cancelled',  className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  cancelled_by_provider: { label: 'Cancelled',  className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  pending_payment:       { label: 'Pending',    className: 'bg-amber-50 text-amber-600 border border-amber-100' },
  no_show:               { label: 'No show',    className: 'bg-red-50 text-red-500 border border-red-100' },
}

const CANCELLABLE: BookingStatus[] = ['confirmed', 'pending_payment']
const RESCHEDULABLE: BookingStatus[] = ['confirmed']

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Cancel dialog ────────────────────────────────────────────────────────────

function CancelDialog({
  booking,
  onConfirm,
  onClose,
  isPending,
}: {
  booking: Booking
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}) {
  const firstItem = booking.items[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[400px] p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-heading font-semibold text-lg text-slate-900">Cancel booking?</p>
            <p className="text-sm text-slate-500">
              {firstItem?.service?.name ?? 'This booking'} on{' '}
              {firstItem ? formatDate(firstItem.start_datetime) : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Are you sure you want to cancel this booking? This action cannot be undone.
        </p>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Keep booking
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Cancelling…' : 'Yes, cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reschedule dialog ────────────────────────────────────────────────────────

function RescheduleDialog({
  booking,
  onConfirm,
  onClose,
  isPending,
}: {
  booking: Booking
  onConfirm: (startDatetime: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const firstItem = booking.items[0]
  const serviceId = firstItem?.service_id ?? ''

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', serviceId, selectedDate],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/availability/slots', {
        params: { query: { service_id: serviceId, date: selectedDate } },
      })
      if (error) throw error
      return data
    },
    enabled: !!selectedDate && !!serviceId,
  })

  const availableSlots = slotsData?.slots.filter((s: TimeSlot) => s.available) ?? []

  const handleConfirm = () => {
    if (!selectedDate || !selectedSlot) return
    onConfirm(`${selectedDate}T${selectedSlot}:00Z`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[440px] p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-heading font-semibold text-lg text-slate-900">Reschedule booking</p>
            <p className="text-sm text-slate-500">
              {firstItem?.service?.name ?? 'This booking'} · currently{' '}
              {firstItem ? formatDate(firstItem.start_datetime) : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Date picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            New date
          </label>
          <input
            type="date"
            min={todayISO()}
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null) }}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-[#1069d1] focus:ring-2 focus:ring-[#1069d1]/20 transition-colors"
          />
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Available times
            </label>
            {slotsLoading ? (
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No available slots on this date.</p>
            ) : (
              <div className="flex gap-2 flex-wrap max-h-[180px] overflow-y-auto">
                {availableSlots.map((slot: TimeSlot) => (
                  <button
                    key={slot.start_time}
                    onClick={() => setSelectedSlot(slot.start_time)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      selectedSlot === slot.start_time
                        ? 'bg-[#1069d1] border-[#1069d1] text-white shadow-sm'
                        : 'border-slate-200 text-slate-700 hover:border-[#1069d1] hover:text-[#1069d1]'
                    }`}
                  >
                    {slot.start_time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !selectedDate || !selectedSlot}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Rescheduling…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onCancelRequest,
  onRescheduleRequest,
}: {
  booking: Booking
  onCancelRequest: (b: Booking) => void
  onRescheduleRequest: (b: Booking) => void
}) {
  const firstItem = booking.items[0]
  const badge = STATUS_BADGE[booking.status] ?? { label: booking.status, className: 'bg-slate-100 text-slate-500' }
  const canCancel = (CANCELLABLE as string[]).includes(booking.status)
  const canReschedule = (RESCHEDULABLE as string[]).includes(booking.status)

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
        <p className="text-sm text-slate-400 italic border-t border-slate-50 pt-3 mb-4">"{booking.notes}"</p>
      )}

      {(canReschedule || canCancel) && (
        <div className="border-t border-slate-100 pt-4 flex gap-2 flex-wrap">
          {canReschedule && (
            <button
              onClick={() => onRescheduleRequest(booking)}
              className="px-4 py-2 text-sm font-medium text-[#1069d1] border border-[#1069d1]/30 bg-[#1069d1]/5 rounded-xl hover:bg-[#1069d1]/10 hover:border-[#1069d1] transition-all"
            >
              Reschedule
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancelRequest(booking)}
              className="px-4 py-2 text-sm font-medium text-red-500 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 hover:border-red-300 transition-all"
            >
              Cancel booking
            </button>
          )}
        </div>
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
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState(0)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null)

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, navigate])

  const selectedStatus = FILTERS[activeFilter]?.status

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings', selectedStatus],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/bookings', {
        params: { query: { status: selectedStatus, per_page: 50 } },
      })
      if (error) throw error
      return data
    },
    enabled: isAuthenticated,
  })

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await api.POST('/api/v1/bookings/{id}/cancel', {
        params: { path: { id: bookingId } },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setCancelTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
  })

  const rescheduleMutation = useMutation({
    mutationFn: async ({ bookingId, startDatetime }: { bookingId: string; startDatetime: string }) => {
      const { error } = await api.PATCH('/api/v1/bookings/{id}/reschedule', {
        params: { path: { id: bookingId } },
        body: { start_datetime: startDatetime },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setRescheduleTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
  })

  if (!isAuthenticated) return null

  const bookings = data?.data ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      {cancelTarget && (
        <CancelDialog
          booking={cancelTarget}
          onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
          onClose={() => setCancelTarget(null)}
          isPending={cancelMutation.isPending}
        />
      )}
      {rescheduleTarget && (
        <RescheduleDialog
          booking={rescheduleTarget}
          onConfirm={(startDatetime) =>
            rescheduleMutation.mutate({ bookingId: rescheduleTarget.id, startDatetime })
          }
          onClose={() => setRescheduleTarget(null)}
          isPending={rescheduleMutation.isPending}
        />
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40">
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
            {bookings.map(b => (
              <BookingCard
                key={b.id}
                booking={b}
                onCancelRequest={setCancelTarget}
                onRescheduleRequest={setRescheduleTarget}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
