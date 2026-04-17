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
  photo_url: string | null
  role: 'administrator' | 'staff'
  location_id: string | null
  status: 'active' | 'pending'
  created_at: string
}

export interface InvitePreview {
  id: string
  email: string
  full_name: string | null
  role: string
  business_id: string
  business_name: string
  location_id: string | null
  expires_at: string
  accepted_at: string | null
  user_exists: boolean
}

export interface MemberProfile {
  id: string
  user_id: string
  business_id: string
  full_name: string
  photo_url: string | null
  updated_at: string
}

export interface RegisterAndAcceptResult {
  user: {
    id: string
    email: string
    name: string
    email_verified: boolean
    is_provider: boolean
  }
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
  }
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

// ─── Memberships ──────────────────────────────────────────────────────────────

export async function getMemberships(): Promise<MembershipsResponse> {
  const res = await fetchWithAuth('/api/v1/me/memberships')
  return res.json()
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function listMembers(businessId: string): Promise<{ data: Member[] }> {
  const res = await fetchWithAuth(`/api/v1/businesses/${businessId}/members`)
  return res.json()
}

export async function inviteMember(
  businessId: string,
  body: {
    email: string
    full_name: string
    role: 'administrator' | 'staff'
    location_id?: string | null
  },
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

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function getInvite(token: string): Promise<InvitePreview> {
  const res = await fetch(`${API_URL}/api/v1/invites/${token}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw body
  }
  return res.json()
}

export async function acceptInvite(token: string): Promise<void> {
  await fetchWithAuth(`/api/v1/invites/${token}/accept`, { method: 'POST' })
}

export async function registerAndAcceptInvite(
  token: string,
  body: { password: string; full_name?: string },
): Promise<RegisterAndAcceptResult> {
  const res = await fetch(`${API_URL}/api/v1/invites/${token}/register-and-accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw errBody
  }
  return res.json()
}

// Login with existing account and immediately accept the invite.
export async function loginAndAcceptInvite(
  token: string,
  email: string,
  password: string,
): Promise<RegisterAndAcceptResult> {
  const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!loginRes.ok) {
    const body = await loginRes.json().catch(() => ({}))
    throw body
  }
  const loginData = await loginRes.json() as RegisterAndAcceptResult

  // Store auth so the next call has a token
  useAuthStore.getState().setAuth(loginData.user, loginData.tokens)

  const acceptToken = useAuthStore.getState().getAccessToken()
  const acceptRes = await fetch(`${API_URL}/api/v1/invites/${token}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(acceptToken ? { Authorization: `Bearer ${acceptToken}` } : {}),
    },
  })
  if (!acceptRes.ok) {
    const body = await acceptRes.json().catch(() => ({}))
    throw body
  }

  return loginData
}

// ─── Member profile ───────────────────────────────────────────────────────────

export async function getMyProfile(businessId: string): Promise<MemberProfile> {
  const res = await fetchWithAuth(`/api/v1/businesses/${businessId}/me/profile`)
  return res.json()
}

export async function updateMyProfile(
  businessId: string,
  body: { full_name: string },
): Promise<MemberProfile> {
  const res = await fetchWithAuth(`/api/v1/businesses/${businessId}/me/profile`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return res.json()
}
