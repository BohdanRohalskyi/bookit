import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { MyBookings } from '../MyBookings'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

let mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const get = () => api.GET as unknown as Mock

type Booking = components['schemas']['Booking']

function buildBooking(overrides?: Partial<Booking>): Booking {
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
      start_datetime: '2026-05-15T09:00:00Z',
      end_datetime: '2026-05-15T10:00:00Z',
      duration_minutes: 60,
      price: 50,
      status: 'confirmed',
    }],
    created_at: '2026-05-10T00:00:00Z',
    ...overrides,
  }
}

function buildList(bookings: Booking[], total = bookings.length) {
  return {
    data: bookings,
    pagination: { page: 1, per_page: 20, total, total_pages: Math.ceil(total / 20) || 1 },
  }
}

beforeEach(() => {
  mockNavigate = vi.fn()
  get().mockReset()
  useAuthStore.getState().logout()
  localStorage.clear()
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('MyBookings auth', () => {
  test('redirects to login when not authenticated', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', expect.anything())
    })
  })
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('MyBookings rendering', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'c@c.com', name: 'Customer', email_verified: true, created_at: '' },
      isAuthenticated: true,
    })
  })

  test('shows page heading', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => {
      expect(screen.getByText(/my bookings/i)).toBeInTheDocument()
    })
  })

  test('shows filter tabs', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /upcoming/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancelled/i })).toBeInTheDocument()
    })
  })

  test('shows empty state when no bookings', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => {
      expect(screen.getByText(/no bookings/i)).toBeInTheDocument()
    })
  })

  test('shows booking cards when data returned', async () => {
    get().mockResolvedValue({ data: buildList([buildBooking(), buildBooking()]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => {
      // Each card shows the price
      expect(screen.getAllByText(/€50/)).toHaveLength(2)
    })
  })

  test('shows status badge on each card', async () => {
    get().mockResolvedValue({ data: buildList([buildBooking({ status: 'confirmed' })]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => {
      expect(screen.getByText(/confirmed/i)).toBeInTheDocument()
    })
  })

  test('shows date and time from first item', async () => {
    get().mockResolvedValue({ data: buildList([buildBooking()]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => {
      expect(screen.getByText(/15 May 2026/i)).toBeInTheDocument()
    })
  })
})

// ─── Filtering ────────────────────────────────────────────────────────────────

describe('MyBookings filtering', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'c@c.com', name: 'Customer', email_verified: true, created_at: '' },
      isAuthenticated: true,
    })
  })

  test('clicking Upcoming tab calls API with status=confirmed', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => expect(screen.getByRole('button', { name: /upcoming/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /upcoming/i }))

    await waitFor(() => {
      expect(get()).toHaveBeenCalledWith(
        '/api/v1/bookings',
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({ status: 'confirmed' }),
          }),
        }),
      )
    })
  })

  test('clicking All tab calls API without status filter', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<MyBookings />, { initialEntries: ['/bookings'] })

    await waitFor(() => expect(screen.getByRole('button', { name: /upcoming/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /upcoming/i }))
    await user.click(screen.getByRole('button', { name: /^all$/i }))

    await waitFor(() => {
      const lastCall = get().mock.calls.at(-1)
      expect(lastCall?.[1]?.params?.query?.status).toBeUndefined()
    })
  })
})
