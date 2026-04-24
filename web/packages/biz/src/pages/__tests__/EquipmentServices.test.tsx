import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { EquipmentServices } from '../EquipmentServices'
import { api } from '@bookit/shared/api'
import { renderWithProviders } from '../../test/utils'
import { useSpaceStore } from '../../stores/spaceStore'
import type { Equipment, Service } from '../../api/catalogApi'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const get = () => api.GET as unknown as Mock
const post = () => api.POST as unknown as Mock
const patch = () => api.PATCH as unknown as Mock
const del = () => api.DELETE as unknown as Mock

const BIZ_ID = 'biz-test-uuid'

function buildEquipment(overrides?: Partial<Equipment>): Equipment {
  return {
    id: crypto.randomUUID(),
    business_id: BIZ_ID,
    name: 'Treadmill',
    quantity_active: 2,
    quantity_inactive: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildService(overrides?: Partial<Service>): Service {
  return {
    id: crypto.randomUUID(),
    business_id: BIZ_ID,
    name: 'Haircut',
    duration_minutes: 30,
    price: 25,
    currency: 'EUR',
    equipment_requirements: [],
    staff_requirements: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// Returns an empty list for equipment and services by default
function mockEmptyLists() {
  get().mockImplementation((path: string) => {
    if (path === '/api/v1/equipment') return Promise.resolve({ data: { data: [] }, error: undefined })
    if (path === '/api/v1/services') return Promise.resolve({ data: { data: [] }, error: undefined })
    return Promise.resolve({ data: null, error: undefined })
  })
}

beforeEach(() => {
  get().mockReset()
  post().mockReset()
  patch().mockReset()
  del().mockReset()
  useSpaceStore.setState({ businessId: BIZ_ID, businessName: 'Test Biz', role: 'owner', locationIds: [], hasHydrated: true })
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('EquipmentServices rendering', () => {
  test('renders page heading', async () => {
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => expect(screen.getByText('Equipment & Services')).toBeInTheDocument())
  })

  test('shows Equipment and Services tabs', async () => {
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^equipment$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^services$/i })).toBeInTheDocument()
    })
  })

  test('Equipment tab is active by default', async () => {
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => expect(screen.getByText('Add equipment')).toBeInTheDocument())
  })
})

// ─── Equipment tab ────────────────────────────────────────────────────────────

describe('Equipment tab', () => {
  test('shows empty state when no equipment', async () => {
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => expect(screen.getByText(/no equipment yet/i)).toBeInTheDocument())
  })

  test('shows active and inactive quantity for each item', async () => {
    get().mockImplementation((path: string) => {
      if (path === '/api/v1/equipment') return Promise.resolve({
        data: { data: [buildEquipment({ name: 'Barbell', quantity_active: 4, quantity_inactive: 2 })] },
        error: undefined,
      })
      return Promise.resolve({ data: { data: [] }, error: undefined })
    })
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => {
      expect(screen.getByText('Barbell')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  test('lists equipment names', async () => {
    get().mockImplementation((path: string) => {
      if (path === '/api/v1/equipment') return Promise.resolve({
        data: { data: [buildEquipment({ name: 'Treadmill' }), buildEquipment({ name: 'Bike' })] },
        error: undefined,
      })
      return Promise.resolve({ data: { data: [] }, error: undefined })
    })
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => {
      expect(screen.getByText('Treadmill')).toBeInTheDocument()
      expect(screen.getByText('Bike')).toBeInTheDocument()
    })
  })

  test('opens add equipment dialog on button click', async () => {
    const user = userEvent.setup()
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => screen.getByText('Add equipment'))
    await user.click(screen.getByText('Add equipment'))
    expect(screen.getByPlaceholderText(/equipment name/i)).toBeInTheDocument()
  })

  test('creates equipment and closes dialog', async () => {
    const user = userEvent.setup()
    const newEquip = buildEquipment({ name: 'Rowing Machine' })
    mockEmptyLists()
    post().mockResolvedValue({ data: newEquip, error: undefined })
    renderWithProviders(<EquipmentServices />)

    await waitFor(() => screen.getByText('Add equipment'))
    await user.click(screen.getByText('Add equipment'))
    await user.type(screen.getByPlaceholderText(/equipment name/i), 'Rowing Machine')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(post()).toHaveBeenCalledWith('/api/v1/equipment', expect.anything()))
  })

  test('opens edit dialog pre-filled with equipment name and quantities', async () => {
    const user = userEvent.setup()
    const eq = buildEquipment({ name: 'Kettlebell', quantity_active: 3, quantity_inactive: 1 })
    get().mockImplementation((path: string) => {
      if (path === '/api/v1/equipment') return Promise.resolve({ data: { data: [eq] }, error: undefined })
      return Promise.resolve({ data: { data: [] }, error: undefined })
    })
    renderWithProviders(<EquipmentServices />)

    await waitFor(() => screen.getByText('Kettlebell'))
    await user.click(screen.getByTitle(`Edit ${eq.name}`))

    const nameInput = screen.getByPlaceholderText(/equipment name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Kettlebell')
    const numberInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    expect(numberInputs[0].value).toBe('3')
    expect(numberInputs[1].value).toBe('1')
  })

  test('shows delete confirmation dialog', async () => {
    const user = userEvent.setup()
    const eq = buildEquipment({ name: 'Dumbbell' })
    get().mockImplementation((path: string) => {
      if (path === '/api/v1/equipment') return Promise.resolve({ data: { data: [eq] }, error: undefined })
      return Promise.resolve({ data: { data: [] }, error: undefined })
    })
    renderWithProviders(<EquipmentServices />)

    await waitFor(() => screen.getByText('Dumbbell'))
    await user.click(screen.getByTitle(`Delete ${eq.name}`))
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
  })

  test('shows inline error when delete returns 409', async () => {
    const user = userEvent.setup()
    const eq = buildEquipment({ name: 'Bench' })
    get().mockImplementation((path: string) => {
      if (path === '/api/v1/equipment') return Promise.resolve({ data: { data: [eq] }, error: undefined })
      return Promise.resolve({ data: { data: [] }, error: undefined })
    })
    del().mockResolvedValue({ error: { status: 409, detail: 'equipment is referenced by one or more services' } })
    renderWithProviders(<EquipmentServices />)

    await waitFor(() => screen.getByText('Bench'))
    await user.click(screen.getByTitle(`Delete ${eq.name}`))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() =>
      expect(screen.getByText(/used by one or more services/i)).toBeInTheDocument()
    )
  })
})

// ─── Services tab ─────────────────────────────────────────────────────────────

describe('Services tab', () => {
  test('switches to Services tab on click', async () => {
    const user = userEvent.setup()
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => screen.getByRole('button', { name: /^services$/i }))
    await user.click(screen.getByRole('button', { name: /^services$/i }))
    expect(screen.getByText('Add service')).toBeInTheDocument()
  })

  test('shows empty state when no services', async () => {
    const user = userEvent.setup()
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => screen.getByRole('button', { name: /^services$/i }))
    await user.click(screen.getByRole('button', { name: /^services$/i }))
    await waitFor(() => expect(screen.getByText(/no services yet/i)).toBeInTheDocument())
  })

  test('lists service names and duration', async () => {
    const user = userEvent.setup()
    const svc = buildService({ name: 'Deep Clean', duration_minutes: 60, price: 80 })
    get().mockImplementation((path: string) => {
      if (path === '/api/v1/services') return Promise.resolve({ data: { data: [svc] }, error: undefined })
      return Promise.resolve({ data: { data: [] }, error: undefined })
    })
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => screen.getByRole('button', { name: /^services$/i }))
    await user.click(screen.getByRole('button', { name: /^services$/i }))
    await waitFor(() => {
      expect(screen.getByText('Deep Clean')).toBeInTheDocument()
      expect(screen.getByText(/60 min/)).toBeInTheDocument()
    })
  })

  test('opens add service dialog on button click', async () => {
    const user = userEvent.setup()
    mockEmptyLists()
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => screen.getByRole('button', { name: /^services$/i }))
    await user.click(screen.getByRole('button', { name: /^services$/i }))
    await user.click(screen.getByText('Add service'))
    expect(screen.getByText('Add service', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText(/service name/i)).toBeInTheDocument()
  })

  test('shows delete confirmation for service', async () => {
    const user = userEvent.setup()
    const svc = buildService({ name: 'Massage' })
    get().mockImplementation((path: string) => {
      if (path === '/api/v1/services') return Promise.resolve({ data: { data: [svc] }, error: undefined })
      return Promise.resolve({ data: { data: [] }, error: undefined })
    })
    renderWithProviders(<EquipmentServices />)
    await waitFor(() => screen.getByRole('button', { name: /^services$/i }))
    await user.click(screen.getByRole('button', { name: /^services$/i }))
    await waitFor(() => screen.getByText('Massage'))
    await user.click(screen.getByTitle(`Delete ${svc.name}`))
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
  })
})
