import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useSpaceStore } from '../stores/spaceStore'
import type { components } from '@bookit/shared/api'

type BookingStatus = components['schemas']['BookingStatus']
type BookingWithConsumer = components['schemas']['Booking'] & {
  consumer_name?: string
  consumer_email?: string
}

// ─── Calendar constants ───────────────────────────────────────────────────────

const HOUR_START = 7   // 07:00
const HOUR_END   = 20  // 20:00
const TOTAL_HOURS = HOUR_END - HOUR_START
const HOUR_PX = 64     // px per hour

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  confirmed:             { bg: 'bg-blue-50',    border: 'border-blue-300',   text: 'text-blue-800' },
  completed:             { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800' },
  cancelled_by_customer: { bg: 'bg-slate-100',  border: 'border-slate-300',  text: 'text-slate-500' },
  cancelled_by_provider: { bg: 'bg-slate-100',  border: 'border-slate-300',  text: 'text-slate-500' },
  pending_payment:       { bg: 'bg-amber-50',   border: 'border-amber-300',  text: 'text-amber-800' },
  no_show:               { bg: 'bg-red-50',     border: 'border-red-300',    text: 'text-red-700' },
}

const NEXT_STATUSES: Record<string, { label: string; status: BookingStatus }[]> = {
  confirmed:       [{ label: 'Complete', status: 'completed' }, { label: 'Cancel', status: 'cancelled_by_provider' }],
  pending_payment: [{ label: 'Confirm', status: 'confirmed' }, { label: 'Cancel', status: 'cancelled_by_provider' }],
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDayHeader(date: Date): { day: string; date: string; isToday: boolean } {
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  return {
    day: DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1],
    date: date.getDate().toString(),
    isToday,
  }
}

function formatMonthYear(monday: Date): string {
  const sunday = addDays(monday, 6)
  if (monday.getMonth() === sunday.getMonth()) {
    return monday.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  return `${monday.toLocaleDateString('en-GB', { month: 'short' })} – ${sunday.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
}

// ─── Booking block position ───────────────────────────────────────────────────

function getBlockStyle(startISO: string, durationMin: number) {
  const start = new Date(startISO)
  const startHour = start.getUTCHours() + start.getUTCMinutes() / 60
  const top = Math.max(0, (startHour - HOUR_START) * HOUR_PX)
  const height = Math.max(HOUR_PX / 4, (durationMin / 60) * HOUR_PX)
  return { top, height }
}

// ─── Booking block component ──────────────────────────────────────────────────

function BookingBlock({
  booking,
  onClick,
}: {
  booking: BookingWithConsumer
  onClick: () => void
}) {
  const item = booking.items[0]
  if (!item) return null

  const { top, height } = getBlockStyle(item.start_datetime, item.duration_minutes)
  const style = STATUS_STYLE[booking.status] ?? STATUS_STYLE.confirmed

  return (
    <button
      onClick={onClick}
      className={`absolute left-0.5 right-0.5 rounded border ${style.bg} ${style.border} ${style.text} text-left overflow-hidden px-1.5 py-1 hover:brightness-95 transition-all cursor-pointer shadow-sm`}
      style={{ top, height }}
    >
      <p className="text-xs font-semibold leading-tight truncate">
        {booking.consumer_name ?? 'Client'}
      </p>
      {height >= HOUR_PX / 2 && (
        <p className="text-[10px] leading-tight opacity-70 truncate">
          {new Date(item.start_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
          {' · '}{item.duration_minutes} min
        </p>
      )}
    </button>
  )
}

// ─── Detail popover ───────────────────────────────────────────────────────────

function BookingDetail({
  booking,
  onClose,
  onStatusChange,
}: {
  booking: BookingWithConsumer
  onClose: () => void
  onStatusChange: (id: string, status: BookingStatus) => void
}) {
  const item = booking.items[0]
  const style = STATUS_STYLE[booking.status] ?? STATUS_STYLE.confirmed
  const nextActions = NEXT_STATUSES[booking.status] ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-xl shadow-xl border border-[rgba(2,9,5,0.08)] p-6 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Status badge */}
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${style.bg} ${style.border} ${style.text}`}>
            {booking.status.replace(/_/g, ' ')}
          </span>
          <button onClick={onClose} className="text-[rgba(2,9,5,0.3)] hover:text-[#020905] text-lg leading-none">×</button>
        </div>

        {/* Consumer */}
        <p className="font-heading font-semibold text-lg text-[#020905] mb-0.5">
          {booking.consumer_name ?? 'Client'}
        </p>
        {booking.consumer_email && (
          <p className="text-sm text-[rgba(2,9,5,0.5)] mb-4">{booking.consumer_email}</p>
        )}

        {/* Slot info */}
        {item && (
          <div className="bg-[#f8f9fa] rounded-lg p-3 mb-4 text-sm text-[rgba(2,9,5,0.7)] space-y-1">
            <p>
              {new Date(item.start_datetime).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p>
              {new Date(item.start_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
              {' – '}
              {new Date(item.end_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
              {' · '}{item.duration_minutes} min
            </p>
            <p className="font-medium text-[#020905]">€{Number(booking.total_amount).toFixed(2)}</p>
          </div>
        )}

        {/* Actions */}
        {nextActions.length > 0 && (
          <div className="flex gap-2">
            {nextActions.map(action => (
              <button
                key={action.status}
                onClick={() => { onStatusChange(booking.id, action.status); onClose() }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-[6px] border transition-colors ${
                  action.status.startsWith('cancelled')
                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                    : 'bg-[#1069d1] text-white border-[#1069d1] hover:bg-[#0d56b0]'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BookingsList() {
  const queryClient = useQueryClient()
  const { businessId } = useSpaceStore()

  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()))
  const [selected, setSelected] = useState<BookingWithConsumer | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const fromDate = toDateStr(weekStart)
  const toDate   = toDateStr(addDays(weekStart, 6))

  const { data, isLoading } = useQuery({
    queryKey: ['provider-bookings', businessId, fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/bookings/provider', {
        params: { query: { from_date: fromDate, to_date: toDate, per_page: 200 } },
      })
      if (error) throw error
      return data
    },
  })

  const bookings = (data?.data ?? []) as BookingWithConsumer[]

  // Group bookings by ISO date string of first item
  const byDay = new Map<string, BookingWithConsumer[]>()
  for (const b of bookings) {
    const d = b.items[0]?.start_datetime?.split('T')[0]
    if (d) {
      if (!byDay.has(d)) byDay.set(d, [])
      byDay.get(d)!.push(b)
    }
  }

  const updateStatus = async (id: string, status: BookingStatus) => {
    const { error } = await api.PATCH('/api/v1/bookings/{id}/status', {
      params: { path: { id } },
      body: { status },
    })
    if (!error) queryClient.invalidateQueries({ queryKey: ['provider-bookings'] })
  }

  const goToToday = () => setWeekStart(getMondayOf(new Date()))

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <p className="font-heading font-semibold text-2xl text-[#020905] mr-2">Bookings</p>

        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm font-medium border border-[rgba(2,9,5,0.15)] rounded-[6px] text-[rgba(2,9,5,0.6)] hover:border-[#1069d1] hover:text-[#1069d1] transition-colors"
        >
          Today
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(w => addDays(w, -7))}
            className="p-1.5 rounded-[6px] text-[rgba(2,9,5,0.4)] hover:bg-[rgba(2,9,5,0.05)] transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setWeekStart(w => addDays(w, 7))}
            className="p-1.5 rounded-[6px] text-[rgba(2,9,5,0.4)] hover:bg-[rgba(2,9,5,0.05)] transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <p className="text-sm font-medium text-[rgba(2,9,5,0.6)]">{formatMonthYear(weekStart)}</p>

        {isLoading && (
          <span className="text-xs text-[rgba(2,9,5,0.3)] ml-auto">Loading…</span>
        )}
      </div>

      {/* ── Calendar grid ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto border border-[rgba(2,9,5,0.08)] rounded-lg bg-white">
        {/* Day headers */}
        <div className="flex border-b border-[rgba(2,9,5,0.08)] sticky top-0 bg-white z-10">
          {/* Time gutter */}
          <div className="w-14 shrink-0 border-r border-[rgba(2,9,5,0.06)]" />
          {weekDays.map((day, i) => {
            const { day: dayLabel, date, isToday } = formatDayHeader(day)
            return (
              <div key={i} className="flex-1 py-2 text-center border-r border-[rgba(2,9,5,0.06)] last:border-r-0">
                <p className="text-xs font-medium text-[rgba(2,9,5,0.4)] uppercase tracking-wide">{dayLabel}</p>
                <div className={`mx-auto mt-0.5 size-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-[#1069d1] text-white' : 'text-[#020905]'
                }`}>
                  {date}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="flex">
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-[rgba(2,9,5,0.06)]">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const hour = HOUR_START + i
              return (
                <div key={hour} style={{ height: HOUR_PX }} className="flex items-start pt-1 pr-2 justify-end">
                  <span className="text-[10px] text-[rgba(2,9,5,0.3)] tabular-nums">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          {weekDays.map((day, i) => {
            const dateStr = toDateStr(day)
            const dayBookings = byDay.get(dateStr) ?? []
            const isToday = day.toDateString() === new Date().toDateString()

            return (
              <div
                key={i}
                className={`flex-1 relative border-r border-[rgba(2,9,5,0.06)] last:border-r-0 ${
                  isToday ? 'bg-blue-50/30' : ''
                }`}
                style={{ height: TOTAL_HOURS * HOUR_PX }}
              >
                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-[rgba(2,9,5,0.05)]"
                    style={{ top: h * HOUR_PX }}
                  />
                ))}

                {/* Booking blocks */}
                {dayBookings.map(b => (
                  <BookingBlock
                    key={b.id}
                    booking={b}
                    onClick={() => setSelected(b)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Detail popover ─────────────────────────────────────────────── */}
      {selected && (
        <BookingDetail
          booking={selected}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
        />
      )}
    </div>
  )
}
