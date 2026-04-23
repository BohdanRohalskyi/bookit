import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { BookingsList } from '../BookingsList'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import type { components } from '@bookit/shared/api'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const get = () => api.GET as unknown as Mock

type Booking = components['schemas']['Booking']

function buildBooking(startISO: string, overrides?: Partial<Booking & { consumer_name?: string }>): Booking & { consumer_name?: string } {
  return {
    id: crypto.randomUUID(),
    location_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    status: 'confirmed',
    total_amount: 50,
    currency: 'EUR',
    items: [{
      id: crypto.randomUUID(),
      service_id: crypto.randomUUID(),
      start_datetime: startISO,
      end_datetime: new Date(new Date(startISO).getTime() + 3600000).toISOString(),
      duration_minutes: 60,
      price: 50,
      status: 'confirmed',
    }],
    created_at: '2026-05-10T00:00:00Z',
    consumer_name: 'Test Customer',
    ...overrides,
  }
}

function buildList(bookings: ReturnType<typeof buildBooking>[], total = bookings.length) {
  return {
    data: bookings,
    pagination: { page: 1, per_page: 200, total, total_pages: 1 },
  }
}

beforeEach(() => {
  get().mockReset()
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('BookingsList calendar rendering', () => {
  test('shows Bookings heading', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText('Bookings')).toBeInTheDocument()
    })
  })

  test('shows Today button and week navigation', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument()
    })
  })

  test('shows 7-day column headers (Mon–Sun)', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Sun')).toBeInTheDocument()
    })
  })

  test('shows time labels on the left', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText('07:00')).toBeInTheDocument()
      expect(screen.getByText('12:00')).toBeInTheDocument()
    })
  })

  test('renders booking block with consumer name', async () => {
    const now = new Date()
    const dow = now.getUTCDay()
    const monday = new Date(now)
    monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1))
    const startISO = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 10, 0, 0)).toISOString()

    get().mockResolvedValue({
      data: buildList([buildBooking(startISO, { consumer_name: 'John Doe' })]),
      error: undefined,
    })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })
})

// ─── Navigation ───────────────────────────────────────────────────────────────

describe('BookingsList week navigation', () => {
  test('clicking next week refetches with new date range', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => expect(screen.getByText('Mon')).toBeInTheDocument())
    const callsBefore = get().mock.calls.length

    // Click the right chevron (next week)
    const buttons = screen.getAllByRole('button')
    const nextBtn = buttons.find(b => b.querySelector('svg'))
    if (nextBtn) await user.click(nextBtn)

    await waitFor(() => {
      expect(get().mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  test('clicking Today resets to current week', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /today/i }))

    // Should still show the calendar
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })
})

// ─── Detail popover ───────────────────────────────────────────────────────────

describe('BookingsList booking detail', () => {
  test('clicking a booking block opens detail popover', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const dow = now.getUTCDay()
    const monday = new Date(now)
    monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1))
    const startISO = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 10, 0, 0)).toISOString()

    get().mockResolvedValue({
      data: buildList([buildBooking(startISO, { consumer_name: 'Jane Smith', status: 'confirmed' })]),
      error: undefined,
    })
    renderWithProviders(<BookingsList />)

    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument())

    // Click the booking block (there should be a button with the consumer name)
    await user.click(screen.getAllByText('Jane Smith')[0])

    // Popover shows detail info + action buttons (exact match to avoid matching filter pills)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^complete$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    })
  })
})
