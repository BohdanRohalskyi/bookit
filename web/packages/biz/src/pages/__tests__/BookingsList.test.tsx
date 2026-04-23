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
const patch = () => api.PATCH as unknown as Mock

type Booking = components['schemas']['Booking']

function buildBooking(overrides?: Partial<Booking & { consumer_name?: string }>): Booking & { consumer_name?: string } {
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
    consumer_name: 'Test Customer',
    ...overrides,
  }
}

function buildList(bookings: ReturnType<typeof buildBooking>[], total = bookings.length) {
  return {
    data: bookings,
    pagination: { page: 1, per_page: 20, total, total_pages: Math.ceil(total / 20) || 1 },
  }
}

beforeEach(() => {
  get().mockReset()
  patch().mockReset()
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('BookingsList rendering', () => {
  test('shows page heading', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/bookings/i)).toBeInTheDocument()
    })
  })

  test('shows status filter tabs', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirmed/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument()
    })
  })

  test('shows empty state when no bookings', async () => {
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText(/no bookings/i)).toBeInTheDocument()
    })
  })

  test('shows booking rows with consumer name and date', async () => {
    get().mockResolvedValue({
      data: buildList([buildBooking({ consumer_name: 'John Doe' })]),
      error: undefined,
    })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText(/15 May 2026/i)).toBeInTheDocument()
    })
  })

  test('shows status badge', async () => {
    get().mockResolvedValue({
      data: buildList([buildBooking({ status: 'confirmed' })]),
      error: undefined,
    })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
    })
  })
})

// ─── Filtering ────────────────────────────────────────────────────────────────

describe('BookingsList filtering', () => {
  test('clicking Confirmed tab filters by status', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildList([]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => expect(screen.getByRole('button', { name: /confirmed/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /confirmed/i }))

    await waitFor(() => {
      expect(get()).toHaveBeenCalledWith(
        '/api/v1/bookings/provider',
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({ status: 'confirmed' }),
          }),
        }),
      )
    })
  })
})

// ─── Status actions ───────────────────────────────────────────────────────────

describe('BookingsList status actions', () => {
  test('confirmed booking shows Complete and Cancel action buttons', async () => {
    get().mockResolvedValue({ data: buildList([buildBooking({ status: 'confirmed' })]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  test('completed booking shows no action buttons', async () => {
    get().mockResolvedValue({ data: buildList([buildBooking({ status: 'completed' })]), error: undefined })
    renderWithProviders(<BookingsList />)

    await waitFor(() => expect(screen.getByText('Completed')).toBeInTheDocument())
    // Completed bookings have no next actions — only the filter tab buttons remain
    expect(screen.queryByRole('button', { name: /^complete$/i })).not.toBeInTheDocument()
  })
})
