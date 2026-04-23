import { screen, waitFor } from '@testing-library/react'
import type { Mock } from 'vitest'
import { ServiceDetailPage } from '../ServiceDetail'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import type { components } from '@bookit/shared/api'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
  }
})

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const get = () => api.GET as unknown as Mock

type ServiceDetail = components['schemas']['ServiceDetail']

function buildDetail(overrides?: Partial<ServiceDetail>): ServiceDetail {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Haircut',
    description: 'A professional haircut service',
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

beforeEach(() => {
  get().mockReset()
})

// ─── Loading ──────────────────────────────────────────────────────────────────

describe('ServiceDetailPage loading', () => {
  test('shows skeleton while loading', () => {
    get().mockReturnValue(new Promise(() => {})) // never resolves
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    // Skeleton renders as animated pulse — page content not yet visible
    expect(screen.queryByRole('button', { name: /book now/i })).not.toBeInTheDocument()
  })
})

// ─── Data display ─────────────────────────────────────────────────────────────

describe('ServiceDetailPage data display', () => {
  test('renders service name and business name', async () => {
    get().mockResolvedValue({ data: buildDetail(), error: undefined })
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByText('Haircut')).toBeInTheDocument()
      expect(screen.getByText('Top Cuts')).toBeInTheDocument()
    })
  })

  test('renders duration and price', async () => {
    get().mockResolvedValue({ data: buildDetail(), error: undefined })
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByText(/60 min/i)).toBeInTheDocument()
      expect(screen.getByText(/25\.00/)).toBeInTheDocument()
    })
  })

  test('renders description when present', async () => {
    get().mockResolvedValue({ data: buildDetail({ description: 'A professional haircut service' }), error: undefined })
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByText('A professional haircut service')).toBeInTheDocument()
    })
  })

  test('renders city when present', async () => {
    get().mockResolvedValue({ data: buildDetail({ city: 'Vilnius' }), error: undefined })
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByText('Vilnius')).toBeInTheDocument()
    })
  })

  test('renders Book now button (disabled — booking not yet implemented)', async () => {
    get().mockResolvedValue({ data: buildDetail(), error: undefined })
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /book now/i })).toBeDisabled()
    })
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('ServiceDetailPage error state', () => {
  test('shows not found state when API returns error', async () => {
    get().mockResolvedValue({ data: undefined, error: { status: 404, title: 'Not Found' } })
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByText(/service not found/i)).toBeInTheDocument()
    })
  })

  test('shows back to search link in error state', async () => {
    get().mockResolvedValue({ data: undefined, error: { status: 404, title: 'Not Found' } })
    renderWithProviders(<ServiceDetailPage />, { initialEntries: ['/services/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to search/i })).toBeInTheDocument()
    })
  })
})
