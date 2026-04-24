import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'

export type Equipment = components['schemas']['Equipment']
export type Service = components['schemas']['Service']

export type ServiceCreateBody = {
  name: string
  description?: string
  duration_minutes: number
  price: number
  currency?: string
  equipment_requirements?: Array<{ equipment_id: string; quantity_needed: number }>
}

export type ServiceUpdateBody = {
  name?: string
  description?: string
  duration_minutes?: number
  price?: number
  currency?: string
  equipment_requirements?: Array<{ equipment_id: string; quantity_needed: number }>
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export async function listEquipment(businessId: string): Promise<Equipment[]> {
  const { data, error } = await api.GET('/api/v1/equipment', {
    params: { query: { business_id: businessId } },
  })
  if (error) throw error
  return data?.data ?? []
}

export async function createEquipment(businessId: string, name: string): Promise<Equipment> {
  const { data, error } = await api.POST('/api/v1/equipment', {
    body: { business_id: businessId, name },
  })
  if (error) throw error
  return data!
}

export async function updateEquipment(id: string, name: string): Promise<Equipment> {
  const { data, error } = await api.PATCH('/api/v1/equipment/{id}', {
    params: { path: { id } },
    body: { name },
  })
  if (error) throw error
  return data!
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await api.DELETE('/api/v1/equipment/{id}', {
    params: { path: { id } },
  })
  if (error) throw error
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function listServices(businessId: string): Promise<Service[]> {
  const { data, error } = await api.GET('/api/v1/services', {
    params: { query: { business_id: businessId } },
  })
  if (error) throw error
  return data?.data ?? []
}

export async function createService(businessId: string, body: ServiceCreateBody): Promise<Service> {
  const { data, error } = await api.POST('/api/v1/services', {
    body: { business_id: businessId, ...body, currency: body.currency ?? 'EUR' },
  })
  if (error) throw error
  return data!
}

export async function updateService(id: string, body: ServiceUpdateBody): Promise<Service> {
  const { data, error } = await api.PATCH('/api/v1/services/{id}', {
    params: { path: { id } },
    body,
  })
  if (error) throw error
  return data!
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await api.DELETE('/api/v1/services/{id}', {
    params: { path: { id } },
  })
  if (error) throw error
}
