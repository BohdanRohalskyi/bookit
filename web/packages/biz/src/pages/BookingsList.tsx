import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, User, Banknote } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useSpaceStore } from '../stores/spaceStore'
import type { components } from '@bookit/shared/api'

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

// Allowed next statuses a provider can set from each current status
const NEXT_STATUSES: Record<string, { label: string; status: BookingStatus }[]> = {
  confirmed:       [{ label: 'Complete', status: 'completed' }, { label: 'Cancel', status: 'cancelled_by_provider' }],
  pending_payment: [{ label: 'Confirm', status: 'confirmed' }, { label: 'Cancel', status: 'cancelled_by_provider' }],
}

const FILTER_TABS: { label: string; status?: BookingStatus }[] = [
  { label: 'All' },
  { label: 'Confirmed',  status: 'confirmed' },
  { label: 'Completed',  status: 'completed' },
  { label: 'Cancelled',  status: 'cancelled_by_provider' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

// ─── Booking row ──────────────────────────────────────────────────────────────

type BookingWithConsumer = components['schemas']['Booking'] & {
  consumer_name?: string
  consumer_email?: string
}

function BookingRow({ booking, onStatusChange }: {
  booking: BookingWithConsumer
  onStatusChange: (id: string, status: BookingStatus) => void
}) {
  const firstItem = booking.items[0]
  const badge = STATUS_BADGE[booking.status]
  const nextActions = NEXT_STATUSES[booking.status] ?? []

  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {badge && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-[rgba(2,9,5,0.6)]">
          {booking.consumer_name && (
            <span className="flex items-center gap-1.5">
              <User className="size-3.5 shrink-0" />
              <span className="truncate font-medium text-[#020905]">{booking.consumer_name}</span>
            </span>
          )}
          {firstItem && (
            <>
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5 shrink-0" />
                {formatDate(firstItem.start_datetime)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" />
                {formatTime(firstItem.start_datetime)} · {firstItem.duration_minutes} min
              </span>
            </>
          )}
          <span className="flex items-center gap-1.5">
            <Banknote className="size-3.5 shrink-0" />
            €{Number(booking.total_amount).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Actions */}
      {nextActions.length > 0 && (
        <div className="flex gap-2 shrink-0">
          {nextActions.map(action => (
            <button
              key={action.status}
              onClick={() => onStatusChange(booking.id, action.status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors border ${
                action.status === 'cancelled_by_provider'
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-[#1069d1] text-[#1069d1] hover:bg-blue-50'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="h-5 bg-gray-100 rounded w-20" />
        <div className="h-5 bg-gray-100 rounded w-32" />
        <div className="h-5 bg-gray-100 rounded w-28" />
        <div className="h-5 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BookingsList() {
  const { businessId } = useSpaceStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState(0)

  const selectedStatus = FILTER_TABS[activeTab]?.status

  const { data, isLoading } = useQuery({
    queryKey: ['provider-bookings', businessId, selectedStatus],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/bookings/provider', {
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
  })

  const updateStatus = async (id: string, status: BookingStatus) => {
    const { error } = await api.PATCH('/api/v1/bookings/{id}/status', {
      params: { path: { id } },
      body: { status },
    })
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['provider-bookings'] })
    }
  }

  const bookings = (data?.data ?? []) as BookingWithConsumer[]

  return (
    <div className="flex flex-col gap-0 max-w-4xl">
      <p className="font-heading font-semibold text-2xl text-[#020905] mb-6">Bookings</p>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {FILTER_TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-[6px] text-sm font-medium transition-colors border ${
              activeTab === i
                ? 'bg-[#1069d1] text-white border-[#1069d1]'
                : 'bg-white text-[rgba(2,9,5,0.6)] border-[rgba(2,9,5,0.15)] hover:border-[#1069d1] hover:text-[#1069d1]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <span className="text-4xl">📅</span>
          <p className="font-heading font-semibold text-lg text-[#020905]">No bookings yet</p>
          <p className="text-sm text-[rgba(2,9,5,0.5)]">Bookings from your clients will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map(b => (
            <BookingRow
              key={b.id}
              booking={b}
              onStatusChange={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
