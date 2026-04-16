import { useAuthStore } from '@bookit/shared/stores'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OwnedBusiness {
  business_id: string
  business_name: string
  category: string
  is_active: boolean
}

export interface RbacMembership {
  business_id: string
  business_name: string
  category: string
  is_active: boolean
  role: 'administrator' | 'staff'
  location_ids: string[]
}

export interface MembershipsResponse {
  owned: OwnedBusiness[]
  memberships: RbacMembership[]
}

export interface Member {
  id: string
  user_id: string | null
  email: string
  name: string | null
  role: 'administrator' | 'staff'
  location_id: string | null
  status: 'active' | 'pending'
  created_at: string
}

export interface InvitePreview {
  id: string
  email: string
  role: string
  business_id: string
  business_name: string
  location_id: string | null
  expires_at: string
  accepted_at: string | null
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().getAccessToken()
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw body
  }
  return res
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getMemberships(): Promise<MembershipsResponse> {
  const res = await fetchWithAuth('/api/v1/me/memberships')
  return res.json()
}

export async function listMembers(businessId: string): Promise<{ data: Member[] }> {
  const res = await fetchWithAuth(`/api/v1/businesses/${businessId}/members`)
  return res.json()
}

export async function inviteMember(
  businessId: string,
  body: { email: string; role: 'administrator' | 'staff'; location_id?: string | null },
): Promise<void> {
  await fetchWithAuth(`/api/v1/businesses/${businessId}/members/invite`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function removeMember(businessId: string, memberId: string): Promise<void> {
  await fetchWithAuth(`/api/v1/businesses/${businessId}/members/${memberId}`, {
    method: 'DELETE',
  })
}

export async function getInvite(token: string): Promise<InvitePreview> {
  const res = await fetchWithAuth(`/api/v1/invites/${token}`)
  return res.json()
}

export async function acceptInvite(token: string): Promise<void> {
  await fetchWithAuth(`/api/v1/invites/${token}/accept`, { method: 'POST' })
}
