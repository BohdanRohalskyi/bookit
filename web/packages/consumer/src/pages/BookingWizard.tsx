import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock, Banknote } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

type ServiceDetail = components['schemas']['ServiceDetail']
type TimeSlot = components['schemas']['TimeSlot']
type Booking = components['schemas']['Booking']

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-[800px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-heading font-semibold text-lg text-slate-900">Bookit</Link>
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Logout
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Date & time', 'Confirm', 'Done']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
              done ? 'bg-emerald-500 text-white' : active ? 'bg-[#1069d1] text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-sm ${active ? 'font-medium text-slate-900' : 'text-slate-400'}`}>{label}</span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-slate-200 mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export function BookingWizard() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/book/${serviceId}`, { replace: true })
    }
  }, [isAuthenticated, navigate, serviceId])

  // Fetch service info
  const { data: service, isLoading: loadingService } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/services/{id}', {
        params: { path: { id: serviceId! } },
      })
      if (error) throw error
      return data as ServiceDetail
    },
    enabled: Boolean(serviceId) && isAuthenticated,
  })

  // Fetch available slots when date is selected
  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ['slots', serviceId, selectedDate],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/availability/slots', {
        params: { query: { service_id: serviceId!, date: selectedDate } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(serviceId) && Boolean(selectedDate) && isAuthenticated,
  })

  useEffect(() => {
    if (slotsData?.location_id) {
      setLocationId(slotsData.location_id)
    }
  }, [slotsData])

  // Reset slot when date changes
  useEffect(() => { setSelectedSlot(null) }, [selectedDate])

  // Book mutation
  const { mutate: createBooking, isPending: booking_ } = useMutation({
    mutationFn: async () => {
      if (!selectedSlot || !selectedDate || !service) throw new Error('Missing selection')
      const startDatetime = `${selectedDate}T${selectedSlot.start_time}:00Z`
      const { data, error } = await api.POST('/api/v1/bookings', {
        body: {
          location_id: locationId,
          items: [{ service_id: serviceId!, start_datetime: startDatetime }],
          notes: notes.trim() || undefined,
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setBooking(data ?? null)
      setBookingError(null)
      setStep(3)
    },
    onError: (err: Error & { detail?: string }) => {
      setBookingError(err.detail ?? err.message ?? 'Booking failed. Please try again.')
    },
  })

  if (!isAuthenticated) return null

  if (loadingService) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-[800px] mx-auto px-6 py-12 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-48 mb-8" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-[800px] mx-auto px-6 py-10">
        {/* Back */}
        {step < 3 && (
          <Link to={`/services/${serviceId}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6"
          >
            <ArrowLeft className="size-4" />
            Back to service
          </Link>
        )}

        <StepIndicator step={step} />

        {/* ── Step 1: Date & slot ─────────────────────────────────────────── */}
        {step === 1 && service && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            <p className="font-heading font-semibold text-2xl text-slate-900 mb-1">{service.name}</p>
            <p className="text-sm text-slate-500 mb-6">{service.business_name}{service.city ? ` · ${service.city}` : ''}</p>

            <div className="flex items-center gap-6 mb-8 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><Clock className="size-4 text-slate-400" />{service.duration_minutes} min</span>
              <span className="flex items-center gap-1.5"><Banknote className="size-4 text-slate-400" />€{Number(service.price).toFixed(2)}</span>
            </div>

            {/* Date picker */}
            <div className="mb-6">
              <label htmlFor="booking-date" className="block text-sm font-medium text-slate-700 mb-2">
                Select a date
              </label>
              <input
                id="booking-date"
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#1069d1] transition-colors text-sm"
              />
            </div>

            {/* Slots */}
            {selectedDate && (
              <div className="mb-8">
                <p className="text-sm font-medium text-slate-700 mb-3">Available times</p>
                {loadingSlots ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : slotsData?.slots.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">No available slots on this date.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slotsData?.slots.map(slot => (
                      <button
                        key={slot.start_time}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 text-sm font-medium rounded-xl transition-colors border ${
                          !slot.available
                            ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50'
                            : selectedSlot?.start_time === slot.start_time
                            ? 'border-[#1069d1] bg-[#1069d1] text-white'
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

            <button
              onClick={() => setStep(2)}
              disabled={!selectedSlot}
              className="px-8 py-3 text-sm font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Confirm ──────────────────────────────────────────────── */}
        {step === 2 && service && selectedSlot && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            <p className="font-heading font-semibold text-2xl text-slate-900 mb-6">Confirm your booking</p>

            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-5 mb-6 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Service</span>
                <span className="font-medium text-slate-900">{service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-900">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time</span>
                <span className="font-medium text-slate-900">{selectedSlot.start_time} – {selectedSlot.end_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration</span>
                <span className="font-medium text-slate-900">{service.duration_minutes} min</span>
              </div>
              <div className="border-t border-slate-200 mt-1 pt-2 flex justify-between">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-slate-900">€{Number(service.price).toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any notes for the provider…"
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1069d1] transition-colors text-sm resize-none"
              />
            </div>

            {bookingError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {bookingError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => createBooking()}
                disabled={booking_}
                className="px-8 py-3 text-sm font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {booking_ ? 'Booking…' : 'Confirm booking'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Success ───────────────────────────────────────────────── */}
        {step === 3 && booking && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
            <CheckCircle2 className="size-16 text-emerald-500 mx-auto mb-4" />
            <p className="font-heading font-semibold text-2xl text-slate-900 mb-2">Booking confirmed!</p>
            <p className="text-slate-500 text-sm mb-1">
              {service?.name} on {selectedDate} at {selectedSlot?.start_time}
            </p>
            <p className="text-xs text-slate-400 mb-8">Booking ID: {booking.id}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/bookings">
                <button className="px-6 py-3 text-sm font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors">
                  View my bookings
                </button>
              </Link>
              <Link to="/search">
                <button className="px-6 py-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  Back to search
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
