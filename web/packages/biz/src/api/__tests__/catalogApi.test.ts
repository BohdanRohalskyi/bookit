import type { Mock } from 'vitest'
import { api } from '@bookit/shared/api'
import {
  listEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  listServices,
  createService,
  updateService,
  deleteService,
} from '../catalogApi'

vi.mock('@bookit/shared/api', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
  API_URL: 'http://localhost:8080',
}))

const get = () => api.GET as unknown as Mock
const post = () => api.POST as unknown as Mock
const patch = () => api.PATCH as unknown as Mock
const del = () => api.DELETE as unknown as Mock

const BIZ_ID = 'biz-uuid-1'
const EQUIP_ID = 'eq-uuid-1'
const SVC_ID = 'svc-uuid-1'

const equipment = { id: EQUIP_ID, business_id: BIZ_ID, name: 'Treadmill', created_at: '2026-01-01T00:00:00Z' }
const service = {
  id: SVC_ID, business_id: BIZ_ID, name: 'Haircut',
  duration_minutes: 30, price: 25, currency: 'EUR',
  equipment_requirements: [], staff_requirements: [],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  get().mockReset(); post().mockReset(); patch().mockReset(); del().mockReset()
})

// ─── Equipment ────────────────────────────────────────────────────────────────

describe('listEquipment', () => {
  test('returns data array on success', async () => {
    get().mockResolvedValue({ data: { data: [equipment] }, error: undefined })
    const result = await listEquipment(BIZ_ID)
    expect(result).toEqual([equipment])
    expect(get()).toHaveBeenCalledWith('/api/v1/equipment', expect.objectContaining({
      params: { query: { business_id: BIZ_ID } },
    }))
  })

  test('returns empty array when data is absent', async () => {
    get().mockResolvedValue({ data: { data: [] }, error: undefined })
    expect(await listEquipment(BIZ_ID)).toEqual([])
  })

  test('throws on error', async () => {
    get().mockResolvedValue({ data: undefined, error: { status: 403 } })
    await expect(listEquipment(BIZ_ID)).rejects.toEqual({ status: 403 })
  })
})

describe('createEquipment', () => {
  test('posts and returns created equipment', async () => {
    post().mockResolvedValue({ data: equipment, error: undefined })
    const result = await createEquipment(BIZ_ID, 'Treadmill')
    expect(result).toEqual(equipment)
    expect(post()).toHaveBeenCalledWith('/api/v1/equipment', expect.objectContaining({
      body: { business_id: BIZ_ID, name: 'Treadmill' },
    }))
  })

  test('throws on error', async () => {
    post().mockResolvedValue({ data: undefined, error: { status: 400 } })
    await expect(createEquipment(BIZ_ID, 'x')).rejects.toEqual({ status: 400 })
  })
})

describe('updateEquipment', () => {
  test('patches and returns updated equipment', async () => {
    patch().mockResolvedValue({ data: { ...equipment, name: 'Bike' }, error: undefined })
    const result = await updateEquipment(EQUIP_ID, 'Bike')
    expect(result.name).toBe('Bike')
    expect(patch()).toHaveBeenCalledWith('/api/v1/equipment/{id}', expect.objectContaining({
      params: { path: { id: EQUIP_ID } },
      body: { name: 'Bike' },
    }))
  })
})

describe('deleteEquipment', () => {
  test('calls DELETE and resolves void', async () => {
    del().mockResolvedValue({ error: undefined })
    await expect(deleteEquipment(EQUIP_ID)).resolves.toBeUndefined()
  })

  test('throws 409 when equipment is in use', async () => {
    del().mockResolvedValue({ error: { status: 409, detail: 'equipment-in-use' } })
    await expect(deleteEquipment(EQUIP_ID)).rejects.toMatchObject({ status: 409 })
  })
})

// ─── Services ─────────────────────────────────────────────────────────────────

describe('listServices', () => {
  test('returns data array on success', async () => {
    get().mockResolvedValue({ data: { data: [service] }, error: undefined })
    expect(await listServices(BIZ_ID)).toEqual([service])
  })

  test('throws on error', async () => {
    get().mockResolvedValue({ data: undefined, error: { status: 403 } })
    await expect(listServices(BIZ_ID)).rejects.toEqual({ status: 403 })
  })
})

describe('createService', () => {
  test('posts and returns created service', async () => {
    post().mockResolvedValue({ data: service, error: undefined })
    const result = await createService(BIZ_ID, { name: 'Haircut', duration_minutes: 30, price: 25 })
    expect(result).toEqual(service)
  })
})

describe('updateService', () => {
  test('patches and returns updated service', async () => {
    patch().mockResolvedValue({ data: { ...service, name: 'Shave' }, error: undefined })
    const result = await updateService(SVC_ID, { name: 'Shave' })
    expect(result.name).toBe('Shave')
  })
})

describe('deleteService', () => {
  test('calls DELETE and resolves void', async () => {
    del().mockResolvedValue({ error: undefined })
    await expect(deleteService(SVC_ID)).resolves.toBeUndefined()
  })
})
