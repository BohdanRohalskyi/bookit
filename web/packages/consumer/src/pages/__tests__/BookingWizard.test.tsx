import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { BookingWizard } from '../BookingWizard'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

let mockNavigate = vi.fn()
let mockParams = { serviceId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  }
})

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const get = () => api.GET as unknown as Mock
const post = () => api.POST as unknown as Mock

type ServiceDetail = components['schemas']['ServiceDetail']
type AvailableSlotsResponse = components['schemas']['AvailableSlotsResponse']
type Booking = components['schemas']['Booking']

function buildService(overrides?: Partial<ServiceDetail>): ServiceDetail {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Haircut',
    description: 'Professional haircut',
    duration_minutes: 60,
    price: 25,
    currency: 'EUR',
    business_id: crypto.randomUUID(),
    business_name: 'Top Cuts',
    category: 'beauty',
    city: 'Vilnius',
    cover_image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildSlotsResponse(available = true): AvailableSlotsResponse {
  return {
    service_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    location_id: crypto.randomUUID(),
    date: '2026-05-15',
    duration_minutes: 60,
    slots: [
      { start_time: '09:00', end_time: '10:00', available },
      { start_time: '10:00', end_time: '11:00', available: true },
    ],
  }
}

function buildBooking(): Booking {
  return {
    id: crypto.randomUUID(),
    location_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    status: 'confirmed',
    total_amount: 25,
    currency: 'EUR',
    items: [{
      id: crypto.randomUUID(),
      service_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      start_datetime: '2026-05-15T09:00:00Z',
      end_datetime: '2026-05-15T10:00:00Z',
      duration_minutes: 60,
      price: 25,
      status: 'confirmed',
    }],
    created_at: '2026-05-10T00:00:00Z',
  }
}

function mockGetSequence(responses: { data: unknown; error: undefined }[]) {
  let call = 0
  get().mockImplementation(() => {
    const resp = responses[Math.min(call, responses.length - 1)]
    call++
    return Promise.resolve(resp)
  })
}

beforeEach(() => {
  mockNavigate = vi.fn()
  mockParams = { serviceId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }
  get().mockReset()
  post().mockReset()
  useAuthStore.getState().logout()
  localStorage.clear()
})

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe('BookingWizard auth guard', () => {
  test('redirects to login when not authenticated', async () => {
    get().mockResolvedValue({ data: buildService(), error: undefined })
    renderWithProviders(<BookingWizard />, { initialEntries: ['/book/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/login'),
        expect.anything(),
      )
    })
  })
})

// ─── Step 1: Date & slot picker ───────────────────────────────────────────────

describe('BookingWizard step 1 — date & slot picker', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', email: 'test@test.com', name: 'Test', email_verified: true, created_at: '' }, isAuthenticated: true })
  })

  test('shows service name and date input', async () => {
    get().mockResolvedValue({ data: buildService(), error: undefined })
    renderWithProviders(<BookingWizard />, { initialEntries: ['/book/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByText('Haircut')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
  })

  test('shows available slots after selecting a date', async () => {
    const user = userEvent.setup()
    mockGetSequence([
      { data: buildService(), error: undefined },
      { data: buildSlotsResponse(), error: undefined },
    ])
    renderWithProviders(<BookingWizard />, { initialEntries: ['/book/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => expect(screen.getByLabelText(/date/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/date/i), '2026-05-15')

    await waitFor(() => {
      expect(screen.getByText('09:00')).toBeInTheDocument()
      expect(screen.getByText('10:00')).toBeInTheDocument()
    })
  })

  test('disables unavailable slots', async () => {
    const user = userEvent.setup()
    mockGetSequence([
      { data: buildService(), error: undefined },
      { data: buildSlotsResponse(false), error: undefined },
    ])
    renderWithProviders(<BookingWizard />, { initialEntries: ['/book/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => expect(screen.getByLabelText(/date/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/date/i), '2026-05-15')

    await waitFor(() => expect(screen.getByText('09:00')).toBeInTheDocument())
    // First slot is unavailable
    const firstSlotButton = screen.getAllByRole('button').find(b => b.textContent?.includes('09:00'))
    expect(firstSlotButton).toBeDisabled()
  })

  test('Continue button disabled until slot selected', async () => {
    get().mockResolvedValue({ data: buildService(), error: undefined })
    renderWithProviders(<BookingWizard />, { initialEntries: ['/book/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})

// ─── Step 2: Confirm ──────────────────────────────────────────────────────────

describe('BookingWizard step 2 — confirm', () => {
  async function reachStep2() {
    const user = userEvent.setup()
    useAuthStore.setState({ user: { id: 'u1', email: 'test@test.com', name: 'Test', email_verified: true, created_at: '' }, isAuthenticated: true })
    mockGetSequence([
      { data: buildService(), error: undefined },
      { data: buildSlotsResponse(), error: undefined },
    ])
    renderWithProviders(<BookingWizard />, { initialEntries: ['/book/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })
    await waitFor(() => expect(screen.getByLabelText(/date/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/date/i), '2026-05-15')
    await waitFor(() => expect(screen.getByText('09:00')).toBeInTheDocument())
    await user.click(screen.getByText('09:00'))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    return user
  }

  test('shows booking summary on step 2', async () => {
    await reachStep2()
    await waitFor(() => {
      expect(screen.getByText('Confirm your booking')).toBeInTheDocument()
      expect(screen.getByText('Haircut')).toBeInTheDocument()
    })
  })

  test('shows notes input on step 2', async () => {
    await reachStep2()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/notes/i)).toBeInTheDocument()
    })
  })

  test('calls POST /api/v1/bookings on confirm', async () => {
    const user = await reachStep2()
    post().mockResolvedValue({ data: buildBooking(), error: undefined })

    await waitFor(() => expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /confirm booking/i }))

    await waitFor(() => {
      expect(post()).toHaveBeenCalledWith('/api/v1/bookings', expect.anything())
    })
  })

  test('shows error when booking fails', async () => {
    const user = await reachStep2()
    post().mockResolvedValue({ data: undefined, error: { title: 'Slot Unavailable', detail: 'The selected time slot is no longer available' } })

    await waitFor(() => expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /confirm booking/i }))

    await waitFor(() => {
      expect(screen.getByText(/no longer available/i)).toBeInTheDocument()
    })
  })
})

// ─── Step 3: Success ──────────────────────────────────────────────────────────

describe('BookingWizard step 3 — success', () => {
  test('shows success screen after confirmed booking', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'test@test.com', name: 'Test', email_verified: true, created_at: '' }, isAuthenticated: true })
    const user = userEvent.setup()
    mockGetSequence([
      { data: buildService(), error: undefined },
      { data: buildSlotsResponse(), error: undefined },
    ])
    post().mockResolvedValue({ data: buildBooking(), error: undefined })

    renderWithProviders(<BookingWizard />, { initialEntries: ['/book/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => expect(screen.getByLabelText(/date/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/date/i), '2026-05-15')
    await waitFor(() => expect(screen.getByText('09:00')).toBeInTheDocument())
    await user.click(screen.getByText('09:00'))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /confirm booking/i }))

    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
    })
  })
})
