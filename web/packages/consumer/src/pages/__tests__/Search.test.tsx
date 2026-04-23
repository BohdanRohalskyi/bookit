import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { SearchPage } from '../Search'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import type { components } from '@bookit/shared/api'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const get = () => api.GET as unknown as Mock

type ServiceSearchResult = components['schemas']['ServiceSearchResult']

function buildService(overrides?: Partial<ServiceSearchResult>): ServiceSearchResult {
  return {
    id: crypto.randomUUID(),
    name: 'Haircut',
    description: 'A great haircut',
    duration_minutes: 60,
    price: 25,
    currency: 'EUR',
    business_id: crypto.randomUUID(),
    business_name: 'Top Cuts',
    category: 'beauty',
    city: 'Vilnius',
    cover_image_url: null,
    ...overrides,
  }
}

function buildSearchResponse(services: ServiceSearchResult[], total = services.length) {
  return {
    data: services,
    pagination: { page: 1, per_page: 20, total, total_pages: Math.ceil(total / 20) },
  }
}

beforeEach(() => {
  get().mockReset()
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('SearchPage rendering', () => {
  test('renders search input and category pills', async () => {
    get().mockResolvedValue({ data: buildSearchResponse([]), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    expect(screen.getByPlaceholderText(/search services/i)).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Beauty')).toBeInTheDocument()
    expect(screen.getByText('Sport')).toBeInTheDocument()
    expect(screen.getByText('Pet care')).toBeInTheDocument()
  })

  test('shows skeletons while loading', () => {
    get().mockReturnValue(new Promise(() => {})) // never resolves
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    // Skeletons are animated divs — we check that results haven't appeared
    expect(screen.queryByText(/services found/i)).not.toBeInTheDocument()
  })
})

// ─── Data display ─────────────────────────────────────────────────────────────

describe('SearchPage data display', () => {
  test('shows service cards when data is returned', async () => {
    const services = [buildService({ name: 'Haircut' }), buildService({ name: 'Yoga class' })]
    get().mockResolvedValue({ data: buildSearchResponse(services), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.getByText('Haircut')).toBeInTheDocument()
      expect(screen.getByText('Yoga class')).toBeInTheDocument()
    })
  })

  test('shows result count', async () => {
    const services = [buildService(), buildService(), buildService()]
    get().mockResolvedValue({ data: buildSearchResponse(services, 3), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.getByText(/3 services found/i)).toBeInTheDocument()
    })
  })

  test('shows singular "service found" for a single result', async () => {
    get().mockResolvedValue({ data: buildSearchResponse([buildService()], 1), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.getByText(/1 service found/i)).toBeInTheDocument()
    })
  })

  test('shows empty state when no results', async () => {
    get().mockResolvedValue({ data: buildSearchResponse([]), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.getByText(/no services found/i)).toBeInTheDocument()
    })
  })

  test('shows "clear all filters" button in empty state', async () => {
    get().mockResolvedValue({ data: buildSearchResponse([]), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument()
    })
  })
})

// ─── Filters ──────────────────────────────────────────────────────────────────

describe('SearchPage filters', () => {
  test('selecting a category pill calls API with category param', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildSearchResponse([]), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await user.click(screen.getByRole('button', { name: 'Beauty' }))

    await waitFor(() => {
      expect(get()).toHaveBeenCalledWith(
        '/api/v1/services/search',
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({ category: 'beauty' }),
          }),
        }),
      )
    })
  })

  test('typing in city input calls API with city param', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildSearchResponse([]), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await user.type(screen.getByPlaceholderText(/city/i), 'Vilnius')

    await waitFor(() => {
      expect(get()).toHaveBeenCalledWith(
        '/api/v1/services/search',
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({ city: 'Vilnius' }),
          }),
        }),
      )
    })
  })

  test('"All" category pill sends no category param', async () => {
    const user = userEvent.setup()
    get().mockResolvedValue({ data: buildSearchResponse([]), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search?category=beauty'] })

    await user.click(screen.getByRole('button', { name: 'All' }))

    await waitFor(() => {
      const lastCall = get().mock.calls.at(-1)
      const query = lastCall?.[1]?.params?.query ?? {}
      expect(query.category).toBeUndefined()
    })
  })
})

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('SearchPage pagination', () => {
  test('shows pagination when total_pages > 1', async () => {
    get().mockResolvedValue({
      data: buildSearchResponse(Array.from({ length: 20 }, () => buildService()), 45),
      error: undefined,
    })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    })
  })

  test('Previous button is disabled on page 1', async () => {
    get().mockResolvedValue({
      data: buildSearchResponse(Array.from({ length: 20 }, () => buildService()), 45),
      error: undefined,
    })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    })
  })

  test('does not show pagination when only one page', async () => {
    get().mockResolvedValue({ data: buildSearchResponse([buildService()], 1), error: undefined })
    renderWithProviders(<SearchPage />, { initialEntries: ['/search'] })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
    })
  })
})
