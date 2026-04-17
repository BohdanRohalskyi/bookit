---
title: "Staff Business Profiles & Invite Acceptance Flow"
status: NEW
created: 2026-04-17
author: "bohdan.rohalskyi@paysera.com"
---

# Plan: Staff Business Profiles & Invite Acceptance Flow

## Summary

Staff members have a per-business profile (full name + photo) separate from their account-level identity.
The invite flow is extended to collect the invitee's name upfront, and the acceptance page handles
both new users (register + set password + accept in one step) and existing users (login + accept).
Email is auto-verified on invite acceptance.

**Goal:** Business-scoped staff profiles, full name on invite, unified invite acceptance page.

---

## Phases

### Phase 1: Feature flag — `staff_profiles` `[DONE]`

Add constant to `web/packages/shared/src/features/flags.ts`:
```ts
STAFF_PROFILES: 'staff_profiles',
```

Gate backend endpoints (profiles CRUD) and frontend pages (profile edit, new invite acceptance page)
with this flag. Existing invite endpoints are not gated — they already work.

**Flag key to activate in Firebase Remote Config:** `staff_profiles`

---

### Phase 2: Database migrations `[PENDING]`

Two migrations:

**Migration 14 — add `full_name` to `invites`:**
```sql
ALTER TABLE invites ADD COLUMN full_name VARCHAR(255);
```

**Migration 15 — create `business_member_profiles`:**
```sql
CREATE TABLE business_member_profiles (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    business_id UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    full_name   VARCHAR(255) NOT NULL,
    photo_url   VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, business_id)
);

CREATE INDEX idx_bmp_user     ON business_member_profiles(user_id);
CREATE INDEX idx_bmp_business ON business_member_profiles(business_id);
```

---

### Phase 3: Backend — invite API changes `[PENDING]`

**Depends on:** Phase 2

#### 3a. OpenAPI spec changes

Update `POST /businesses/{id}/members/invite` request body — add `full_name: string (required)`.

Update `GET /invites/{token}` response — add:
- `full_name: string`
- `business_name: string` (already returned via service, add to spec)
- `user_exists: boolean` — tells the frontend whether to show login or register form

Add new endpoint `POST /invites/{token}/register-and-accept`:
```yaml
requestBody:
  required: [password]
  optional: [full_name]   # override pre-filled name
responses:
  200: { access_token, user }  # same shape as /auth/login
  400: invalid password
  404: invite not found
  409: email already registered (use /accept instead)
  410: invite expired or already used
```

Regenerate types after spec changes.

#### 3b. Go changes

**`staff/staff.go`**
- Add `FullName string` to `Invite`, `InviteCreate`, `InviteMemberInput`
- Add `UserExists bool` to `Invite` (set by service on preview)

**`staff/service.go` — `InviteMember`**
- Pass `full_name` through to `InviteCreate`
- Include name in `StaffInvite` template call

**`staff/service.go` — `PreviewInvite`**
- After loading invite, call `repo.FindUserIDByEmail(ctx, invite.Email)` to set `UserExists`

**`staff/service.go` — `AcceptInvite`**
- After accepting: `UPDATE users SET email_verified = true WHERE id = $1`
- Create `business_member_profiles` row with name from invite

**`staff/service.go` — new `RegisterAndAcceptInvite(ctx, token, password string) (*TokenPair, error)`**
- Load and validate invite (not expired, not used)
- Check email not already registered → 409 if it is
- Hash password, insert user with `email_verified = true`
- Accept invite atomically (mark accepted, assign role)
- Create `business_member_profiles` row
- Issue JWT access + refresh tokens
- Return token pair

**`staff/handler.go`** — new `RegisterAndAcceptInvite` handler (no auth middleware — token is the auth)

**`staff/repository.go`** — new queries:
- `CreateMemberProfile(ctx, userID, businessID, fullName uuid.UUID) error`
- `VerifyUserEmail(ctx, userID uuid.UUID) error`

---

### Phase 4: Backend — business member profile CRUD `[PENDING]`

**Depends on:** Phase 3

#### 4a. OpenAPI spec

```
GET  /businesses/{id}/me/profile        → MemberProfile
PUT  /businesses/{id}/me/profile        → { full_name }
POST /businesses/{id}/me/profile/photo  → { photo_url }
```

All three require auth. GET/PUT/photo are for the authenticated user's OWN profile within that business.

Response schema `MemberProfile`:
```yaml
id, user_id, business_id, full_name, photo_url, updated_at
```

#### 4b. Go changes

**`staff/repository.go`**
- `GetMemberProfile(ctx, userID, businessID) (MemberProfile, error)`
- `UpdateMemberProfile(ctx, userID, businessID, fullName string) error`
- `UpdateMemberProfilePhoto(ctx, userID, businessID, photoURL string) error`

**`staff/service.go`**
- `GetMyProfile`, `UpdateMyProfile`, `UploadMyProfilePhoto` — thin wrappers, validate user belongs to business

**`staff/handler.go`**
- `GetMyProfile`, `UpdateMyProfile`, `UploadMyProfilePhoto`
- Photo upload: reuse same GCS/local storage pattern as location photos

**Also:** Update `ListMembers` to join `business_member_profiles` and include `full_name` + `photo_url` in member list response.

---

### Phase 5: Frontend — invite acceptance page `[PENDING]`

**Depends on:** Phase 3

Route: `/invites` (already exists, needs full rebuild)

**Page flow:**
1. On mount: `GET /invites/:token`
   - If expired/used → show error state
2. Display: business name, role, invitee full name
3. Branch on `user_exists`:
   - **`user_exists: false`** → show registration form:
     - Full name (pre-filled from invite, editable)
     - Email (read-only, from invite)
     - Password + confirm password
     - Submit → `POST /invites/:token/register-and-accept` → store tokens → redirect to biz dashboard
   - **`user_exists: true`** → show login prompt:
     - "You already have a Bookit account. Log in to accept."
     - Email (read-only)
     - Password
     - Submit → `POST /auth/login` → then `POST /invites/:token/accept` → redirect to biz dashboard

Gate the new page behind `FLAGS.STAFF_PROFILES`. Keep the old acceptance flow as fallback until flag is activated.

---

### Phase 6: Frontend — staff profile editing `[PENDING]`

**Depends on:** Phase 4

Route: `/businesses/:id/profile` (within biz app, protected)

**Page:**
- Fetch `GET /businesses/:id/me/profile`
- Editable full name field
- Photo upload (reuse existing upload component pattern)
- Save button → `PUT /businesses/:id/me/profile`

**Also:** Show member name + photo in the Members list (data already returned from Phase 4 backend).

Gate behind `FLAGS.STAFF_PROFILES`.

---

## Dependencies

```
Phase 1 (flag)
    ↓
Phase 2 (DB)
    ↓
Phase 3 (invite API)   Phase 4 (profile CRUD)
    ↓                       ↓
Phase 5 (invite UI)    Phase 6 (profile UI)
```

Phases 3 and 4 can be developed in parallel after Phase 2.
Phases 5 and 6 can be developed in parallel after their respective backend phases.

---

## Phase Status Reference

| Status | Meaning |
|--------|---------|
| `[PENDING]` | Not started |
| `[IN_PROGRESS]` | Currently being worked on |
| `[DONE]` | Completed and committed |
| `[CHANGED]` | Implementation differs from original plan |
| `[REJECTED]` | Phase was not implemented |
