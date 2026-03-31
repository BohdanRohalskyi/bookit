# Backend Specification — Bookit

> **Implementation-Ready Backend Specification**
>
> Derived from: BRD-Bookit-20260327.md, NFR-Bookit-20260327.md, HLD-Bookit-20260330.md

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document version | v1.0 |
| Created date | 2026-03-31 |
| Target language | Go |
| API style | REST + OpenAPI 3.x |
| Base path | `/api/v1` |

---

## 1. Authentication Configuration

| Setting | Value |
|---------|-------|
| Access token lifetime | 30 minutes |
| Refresh token lifetime | 30 days |
| Token storage (web) | httpOnly cookie |
| Token storage (mobile) | Secure storage |
| Password hashing | bcrypt (cost 12) |
| Refresh token rotation | Yes (on each use) |

---

## 2. Common Types

### 2.1 Request/Response Wrappers

```go
// Pagination request (query params)
type PaginationParams struct {
    Page    int `form:"page" validate:"min=1"`          // default: 1
    PerPage int `form:"per_page" validate:"min=1,max=100"` // default: 20
}

// Pagination response
type Pagination struct {
    Page       int `json:"page"`
    PerPage    int `json:"per_page"`
    Total      int `json:"total"`
    TotalPages int `json:"total_pages"`
}

// Paginated list wrapper
type PaginatedList[T any] struct {
    Data       []T        `json:"data"`
    Pagination Pagination `json:"pagination"`
}
```

### 2.2 Error Responses

```go
// Simple error
type ErrorResponse struct {
    Message string `json:"message"`
}

// Validation error
type ValidationErrorResponse struct {
    Message string            `json:"message"`
    Errors  map[string]string `json:"errors"`
}
```

### 2.3 Enums

```go
type OAuthProvider string
const (
    OAuthProviderGoogle   OAuthProvider = "google"
    OAuthProviderFacebook OAuthProvider = "facebook"
    OAuthProviderPaysera  OAuthProvider = "paysera"
)

type ProviderStatus string
const (
    ProviderStatusActive    ProviderStatus = "active"
    ProviderStatusInactive  ProviderStatus = "inactive"
    ProviderStatusSuspended ProviderStatus = "suspended"
)

type BusinessCategory string
const (
    BusinessCategoryBeauty  BusinessCategory = "beauty"
    BusinessCategorySport   BusinessCategory = "sport"
    BusinessCategoryPetCare BusinessCategory = "pet_care"
)

type DurationType string
const (
    DurationTypeFixed    DurationType = "fixed"
    DurationTypeFlexible DurationType = "flexible"
)

type PriceType string
const (
    PriceTypeFlat    PriceType = "flat"
    PriceTypePerUnit PriceType = "per_unit"
)

type BookingStatus string
const (
    BookingStatusPendingPayment      BookingStatus = "pending_payment"
    BookingStatusConfirmed           BookingStatus = "confirmed"
    BookingStatusCancelledByCustomer BookingStatus = "cancelled_by_customer"
    BookingStatusCancelledByProvider BookingStatus = "cancelled_by_provider"
    BookingStatusCompleted           BookingStatus = "completed"
    BookingStatusNoShow              BookingStatus = "no_show"
)

type BookingItemStatus string
const (
    BookingItemStatusPending   BookingItemStatus = "pending"
    BookingItemStatusConfirmed BookingItemStatus = "confirmed"
    BookingItemStatusCancelled BookingItemStatus = "cancelled"
    BookingItemStatusCompleted BookingItemStatus = "completed"
)
```

---

## 3. Workflow 0: Authentication

### 3.1 POST /api/v1/auth/register

**Description:** Register a new user with email and password.

#### Request

```go
type RegisterRequest struct {
    Email    string `json:"email" validate:"required,email,max=255"`
    Password string `json:"password" validate:"required,min=8,max=72"`
    Name     string `json:"name" validate:"required,min=1,max=100"`
    Phone    string `json:"phone" validate:"required,e164"`
}
```

#### Response

```go
// 201 Created
type AuthResponse struct {
    User   UserResponse   `json:"user"`
    Tokens TokensResponse `json:"tokens"`
}

type UserResponse struct {
    ID            uuid.UUID  `json:"id"`
    Email         string     `json:"email"`
    Name          string     `json:"name"`
    Phone         *string    `json:"phone,omitempty"`
    EmailVerified bool       `json:"email_verified"`
    IsProvider    bool       `json:"is_provider"`
    CreatedAt     time.Time  `json:"created_at"`
    UpdatedAt     time.Time  `json:"updated_at"`
}

type TokensResponse struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int    `json:"expires_in"` // 1800 (30 min in seconds)
}
```

#### Business Rules

1. Email must be unique (case-insensitive comparison)
2. Password hashed with bcrypt (cost 12)
3. `email_verified` = false until verified via email link
4. Verification email sent asynchronously (event: `UserRegistered`)
5. User can log in before email verification
6. Refresh token stored as SHA-256 hash in DB

#### Auth Matrix

| Role | Access |
|------|--------|
| Unauthenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | validation-error | Invalid input |
| 409 | email-already-exists | Email taken |

#### Query Pattern

1. SELECT users WHERE lower(email) = lower(?)
2. INSERT users
3. INSERT user_auth_methods (provider='email')
4. INSERT refresh_tokens
5. EMIT UserRegistered event

---

### 3.2 POST /api/v1/auth/login

**Description:** Authenticate with email and password.

#### Request

```go
type LoginRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required"`
}
```

#### Response

```go
// 200 OK
type AuthResponse // same as register
```

#### Business Rules

1. Compare password with bcrypt hash
2. Account not locked/suspended
3. Create new refresh token, store hash
4. Return user with current `email_verified` status

#### Auth Matrix

| Role | Access |
|------|--------|
| Unauthenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 401 | invalid-credentials | Wrong email or password |

#### Query Pattern

1. SELECT users WHERE lower(email) = lower(?)
2. Verify bcrypt hash
3. INSERT refresh_tokens
4. SELECT providers WHERE user_id = ? (to set is_provider)

---

### 3.3 POST /api/v1/auth/refresh

**Description:** Exchange refresh token for new token pair.

#### Request

```go
type RefreshRequest struct {
    RefreshToken string `json:"refresh_token" validate:"required"`
}
```

#### Response

```go
// 200 OK
type AuthResponse // same as register
```

#### Business Rules

1. Hash provided token, lookup in DB
2. Token must not be expired
3. Token must not be revoked
4. Rotate: revoke old token, issue new pair
5. Return updated user data

#### Auth Matrix

| Role | Access |
|------|--------|
| Unauthenticated | Yes (token-based auth) |

#### Errors

| Status | Code | When |
|--------|------|------|
| 401 | invalid-refresh-token | Token invalid, expired, or revoked |

#### Query Pattern

1. SELECT refresh_tokens WHERE token_hash = SHA256(?)
2. Verify not expired, not revoked
3. UPDATE refresh_tokens SET revoked_at = now()
4. INSERT refresh_tokens (new token)
5. SELECT users, providers for response

---

### 3.4 POST /api/v1/auth/logout

**Description:** Revoke refresh token.

#### Request

```go
type LogoutRequest struct {
    RefreshToken string `json:"refresh_token" validate:"required"`
}
```

#### Response

```go
// 204 No Content
```

#### Business Rules

1. Revoke the specified refresh token
2. Silently succeed even if token not found (idempotent)

#### Auth Matrix

| Role | Access |
|------|--------|
| Authenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 401 | unauthorized | Missing/invalid access token |

#### Query Pattern

1. UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = SHA256(?)

---

### 3.5 POST /api/v1/auth/verify-email

**Description:** Verify user's email with token from email link.

#### Request

```go
type VerifyEmailRequest struct {
    Token string `json:"token" validate:"required"`
}
```

#### Response

```go
// 200 OK
type MessageResponse struct {
    Message string `json:"message"`
}
```

#### Business Rules

1. Token is a signed JWT or random string stored in DB
2. Token must not be expired (24h validity)
3. Token must not be already used
4. Set `email_verified` = true on user record
5. Invalidate the token after use

#### Auth Matrix

| Role | Access |
|------|--------|
| Unauthenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | invalid-token | Token invalid, expired, or already used |

#### Query Pattern

1. Verify JWT signature OR SELECT email_verification_tokens WHERE token = ?
2. UPDATE users SET email_verified = true WHERE id = ?
3. DELETE/invalidate token

---

### 3.6 POST /api/v1/auth/resend-verification

**Description:** Resend verification email to current user.

#### Request

```go
// No body required - uses authenticated user
```

#### Response

```go
// 200 OK
type MessageResponse struct {
    Message string `json:"message"` // "Verification email sent"
}
```

#### Business Rules

1. User must be authenticated
2. User's email must not already be verified
3. Rate limit: max 3 requests per hour per user
4. Generate new verification token
5. Send email asynchronously

#### Auth Matrix

| Role | Access |
|------|--------|
| Authenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | email-already-verified | Email already verified |
| 401 | unauthorized | Not authenticated |
| 429 | rate-limited | Too many requests |

#### Query Pattern

1. SELECT users WHERE id = ? (check email_verified)
2. Check rate limit (Redis or DB counter)
3. Generate token, store if DB-based
4. EMIT SendVerificationEmail event

---

### 3.7 GET /api/v1/auth/oauth/{provider}

**Description:** Initiate OAuth flow, redirect to provider.

#### Request

```go
// Path param
type OAuthInitiateParams struct {
    Provider OAuthProvider `uri:"provider" validate:"required,oneof=google facebook paysera"`
}

// Query param
type OAuthInitiateQuery struct {
    RedirectURI *string `form:"redirect_uri" validate:"omitempty,url"`
}
```

#### Response

```go
// 302 Redirect to OAuth provider
```

#### Business Rules

1. Generate random `state` parameter, store in session/cache
2. Build OAuth authorization URL with scopes
3. Store `redirect_uri` in session for callback
4. Redirect user to provider

#### Auth Matrix

| Role | Access |
|------|--------|
| Unauthenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | invalid-provider | Unknown OAuth provider |

---

### 3.8 GET /api/v1/auth/oauth/{provider}/callback

**Description:** Handle OAuth callback, exchange code for tokens.

#### Request

```go
// Path param
type OAuthCallbackParams struct {
    Provider OAuthProvider `uri:"provider"`
}

// Query params (from OAuth provider)
type OAuthCallbackQuery struct {
    Code  string `form:"code" validate:"required"`
    State string `form:"state" validate:"required"`
}
```

#### Response

```go
// 200 OK
type AuthResponse // same as register
```

#### Business Rules

1. Verify `state` matches stored value (CSRF protection)
2. Exchange `code` for OAuth tokens with provider
3. Fetch user info from provider (email, name)
4. If user exists with this email: link OAuth method, log in
5. If new user: create account with `email_verified` = true (OAuth-verified)
6. Issue JWT + refresh token

#### Auth Matrix

| Role | Access |
|------|--------|
| Unauthenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | oauth-failed | Invalid code, state mismatch, or provider error |

#### Query Pattern

1. Verify state from cache/session
2. Exchange code with provider API
3. SELECT users WHERE email = ?
4. INSERT users (if new) or SELECT existing
5. INSERT/UPDATE user_auth_methods
6. INSERT refresh_tokens

---

## 4. Workflow 1: User Profile

### 4.1 GET /api/v1/users/me

**Description:** Get current authenticated user's profile.

#### Response

```go
// 200 OK
type UserResponse // defined above
```

#### Business Rules

1. Return current user from JWT claims
2. Include `is_provider` status

#### Auth Matrix

| Role | Access |
|------|--------|
| Authenticated | Yes |

#### Query Pattern

1. SELECT users WHERE id = ? (from JWT)
2. SELECT providers WHERE user_id = ? (for is_provider)

---

### 4.2 PUT /api/v1/users/me

**Description:** Update current user's profile.

#### Request

```go
type UpdateUserRequest struct {
    Name  *string `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
    Phone *string `json:"phone,omitempty" validate:"omitempty,e164"`
}
```

#### Response

```go
// 200 OK
type UserResponse
```

#### Business Rules

1. Only update provided fields (partial update)
2. Cannot change email via this endpoint
3. Update `updated_at` timestamp

#### Auth Matrix

| Role | Access |
|------|--------|
| Authenticated | Yes |

#### Query Pattern

1. UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), updated_at = now() WHERE id = ?

---

## 5. Workflow 2: Provider Onboarding

### 5.1 POST /api/v1/providers

**Description:** Upgrade current user to provider status.

#### Request

```go
// No body required
```

#### Response

```go
// 201 Created
type ProviderResponse struct {
    ID        uuid.UUID      `json:"id"`
    UserID    uuid.UUID      `json:"user_id"`
    Status    ProviderStatus `json:"status"`
    CreatedAt time.Time      `json:"created_at"`
}
```

#### Business Rules

1. User must be authenticated
2. User must not already be a provider
3. Create provider record with `status` = active
4. User can now create businesses

#### Auth Matrix

| Role | Access |
|------|--------|
| Authenticated (non-provider) | Yes |
| Provider | No (409) |

#### Errors

| Status | Code | When |
|--------|------|------|
| 409 | already-provider | User is already a provider |

#### Query Pattern

1. SELECT providers WHERE user_id = ?
2. INSERT providers (user_id, status='active')

---

### 5.2 GET /api/v1/providers/me

**Description:** Get current user's provider profile.

#### Response

```go
// 200 OK
type ProviderResponse
```

#### Auth Matrix

| Role | Access |
|------|--------|
| Provider | Yes |
| Non-provider | 403 |

#### Query Pattern

1. SELECT providers WHERE user_id = ?

---

## 6. Workflow 3: Business Management

### 6.1 GET /api/v1/businesses

**Description:** List businesses owned by current provider.

#### Request

```go
// Query params
type ListBusinessesQuery struct {
    PaginationParams
}
```

#### Response

```go
// 200 OK
type BusinessListResponse = PaginatedList[BusinessResponse]

type BusinessResponse struct {
    ID            uuid.UUID        `json:"id"`
    ProviderID    uuid.UUID        `json:"provider_id"`
    Name          string           `json:"name"`
    Category      BusinessCategory `json:"category"`
    Description   *string          `json:"description,omitempty"`
    LogoURL       *string          `json:"logo_url,omitempty"`
    CoverImageURL *string          `json:"cover_image_url,omitempty"`
    IsActive      bool             `json:"is_active"`
    CreatedAt     time.Time        `json:"created_at"`
    UpdatedAt     time.Time        `json:"updated_at"`
}
```

#### Auth Matrix

| Role | Access |
|------|--------|
| Provider | Yes (own businesses only) |

#### Query Pattern

1. SELECT businesses WHERE provider_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
2. SELECT COUNT(*) FROM businesses WHERE provider_id = ?

---

### 6.2 POST /api/v1/businesses

**Description:** Create a new business.

#### Request

```go
type CreateBusinessRequest struct {
    Name        string           `json:"name" validate:"required,min=1,max=100"`
    Category    BusinessCategory `json:"category" validate:"required,oneof=beauty sport pet_care"`
    Description *string          `json:"description,omitempty" validate:"omitempty,max=1000"`
}
```

#### Response

```go
// 201 Created
type BusinessResponse
```

#### Business Rules

1. Provider can own multiple businesses
2. `is_active` defaults to true
3. Logo/cover images uploaded separately

#### Auth Matrix

| Role | Access |
|------|--------|
| Provider | Yes |

#### Query Pattern

1. INSERT businesses (provider_id, name, category, description, is_active=true)

---

### 6.3 GET /api/v1/businesses/{id}

**Description:** Get a specific business.

#### Request

```go
type GetBusinessParams struct {
    ID uuid.UUID `uri:"id" validate:"required,uuid"`
}
```

#### Response

```go
// 200 OK
type BusinessResponse
```

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Provider | Yes | Own business only |

#### Errors

| Status | Code | When |
|--------|------|------|
| 404 | not-found | Business not found or not owned |

#### Query Pattern

1. SELECT businesses WHERE id = ? AND provider_id = ?

---

### 6.4 PUT /api/v1/businesses/{id}

**Description:** Update a business.

#### Request

```go
type UpdateBusinessRequest struct {
    Name        *string `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
    Description *string `json:"description,omitempty" validate:"omitempty,max=1000"`
    IsActive    *bool   `json:"is_active,omitempty"`
}
```

#### Response

```go
// 200 OK
type BusinessResponse
```

#### Business Rules

1. Cannot change category after creation
2. Partial update - only provided fields

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Provider | Yes | Own business only |

#### Query Pattern

1. UPDATE businesses SET ... WHERE id = ? AND provider_id = ?

---

## 7. Workflow 4: Location Management

### 7.1 GET /api/v1/locations

**Description:** List locations for a business.

#### Request

```go
type ListLocationsQuery struct {
    BusinessID uuid.UUID `form:"business_id" validate:"required,uuid"`
    PaginationParams
}
```

#### Response

```go
// 200 OK
type LocationListResponse = PaginatedList[LocationResponse]

type LocationResponse struct {
    ID        uuid.UUID  `json:"id"`
    BusinessID uuid.UUID `json:"business_id"`
    Name      string     `json:"name"`
    Address   string     `json:"address"`
    City      string     `json:"city"`
    Country   string     `json:"country"`
    Phone     *string    `json:"phone,omitempty"`
    Email     *string    `json:"email,omitempty"`
    Lat       *float64   `json:"lat,omitempty"`
    Lng       *float64   `json:"lng,omitempty"`
    Timezone  string     `json:"timezone"`
    IsActive  bool       `json:"is_active"`
    CreatedAt time.Time  `json:"created_at"`
    UpdatedAt time.Time  `json:"updated_at"`
}
```

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Provider | Yes | Own business only |

#### Query Pattern

1. SELECT businesses WHERE id = ? AND provider_id = ? (ownership check)
2. SELECT locations WHERE business_id = ?

---

### 7.2 POST /api/v1/locations

**Description:** Create a location for a business.

#### Request

```go
type CreateLocationRequest struct {
    BusinessID uuid.UUID `json:"business_id" validate:"required,uuid"`
    Name       string    `json:"name" validate:"required,min=1,max=100"`
    Address    string    `json:"address" validate:"required,max=200"`
    City       string    `json:"city" validate:"required,max=100"`
    Country    string    `json:"country" validate:"required,max=100"`
    Phone      *string   `json:"phone,omitempty"`
    Email      *string   `json:"email,omitempty" validate:"omitempty,email"`
    Lat        *float64  `json:"lat,omitempty" validate:"omitempty,latitude"`
    Lng        *float64  `json:"lng,omitempty" validate:"omitempty,longitude"`
    Timezone   *string   `json:"timezone,omitempty"` // default: Europe/Vilnius
}
```

#### Response

```go
// 201 Created
type LocationResponse
```

#### Business Rules

1. Business must belong to current provider
2. Default timezone: Europe/Vilnius
3. `is_active` defaults to true

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Provider | Yes | Own business only |

#### Errors

| Status | Code | When |
|--------|------|------|
| 403 | forbidden | Business not owned by provider |

#### Query Pattern

1. SELECT businesses WHERE id = ? AND provider_id = ?
2. INSERT locations

---

### 7.3 GET /api/v1/locations/{id}

**Description:** Get a specific location.

#### Response

```go
// 200 OK
type LocationResponse
```

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Provider | Yes | Own location only |

#### Query Pattern

1. SELECT locations l JOIN businesses b ON l.business_id = b.id WHERE l.id = ? AND b.provider_id = ?

---

### 7.4 PUT /api/v1/locations/{id}

**Description:** Update a location.

#### Request

```go
type UpdateLocationRequest struct {
    Name     *string  `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
    Address  *string  `json:"address,omitempty" validate:"omitempty,max=200"`
    City     *string  `json:"city,omitempty" validate:"omitempty,max=100"`
    Country  *string  `json:"country,omitempty" validate:"omitempty,max=100"`
    Phone    *string  `json:"phone,omitempty"`
    Email    *string  `json:"email,omitempty" validate:"omitempty,email"`
    Lat      *float64 `json:"lat,omitempty"`
    Lng      *float64 `json:"lng,omitempty"`
    Timezone *string  `json:"timezone,omitempty"`
    IsActive *bool    `json:"is_active,omitempty"`
}
```

#### Response

```go
// 200 OK
type LocationResponse
```

---

## 8. Workflow 5: Service Management

### 8.1 GET /api/v1/services

**Description:** List services for a location.

#### Request

```go
type ListServicesQuery struct {
    LocationID uuid.UUID `form:"location_id" validate:"required,uuid"`
    PaginationParams
}
```

#### Response

```go
// 200 OK
type ServiceListResponse = PaginatedList[ServiceResponse]

type ServiceResponse struct {
    ID                 uuid.UUID    `json:"id"`
    LocationID         uuid.UUID    `json:"location_id"`
    Name               string       `json:"name"`
    Description        *string      `json:"description,omitempty"`
    DurationType       DurationType `json:"duration_type"`
    DurationMinutes    *int         `json:"duration_minutes,omitempty"`    // for fixed
    TimeUnitMinutes    *int         `json:"time_unit_minutes,omitempty"`   // for flexible (30 or 60)
    MinDurationMinutes *int         `json:"min_duration_minutes,omitempty"` // for flexible
    MaxDurationMinutes *int         `json:"max_duration_minutes,omitempty"` // for flexible
    Price              float64      `json:"price"`
    PriceType          PriceType    `json:"price_type"`
    Currency           string       `json:"currency"`
    IsActive           bool         `json:"is_active"`
    DisplayOrder       int          `json:"display_order"`
    CreatedAt          time.Time    `json:"created_at"`
    UpdatedAt          time.Time    `json:"updated_at"`
}
```

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Provider | Yes | Own location only |

---

### 8.2 POST /api/v1/services

**Description:** Create a service for a location.

#### Request

```go
type CreateServiceRequest struct {
    LocationID         uuid.UUID    `json:"location_id" validate:"required,uuid"`
    Name               string       `json:"name" validate:"required,min=1,max=100"`
    Description        *string      `json:"description,omitempty" validate:"omitempty,max=500"`
    DurationType       DurationType `json:"duration_type" validate:"required,oneof=fixed flexible"`
    DurationMinutes    *int         `json:"duration_minutes,omitempty" validate:"omitempty,min=15"`
    TimeUnitMinutes    *int         `json:"time_unit_minutes,omitempty" validate:"omitempty,oneof=30 60"`
    MinDurationMinutes *int         `json:"min_duration_minutes,omitempty" validate:"omitempty,min=15"`
    MaxDurationMinutes *int         `json:"max_duration_minutes,omitempty"`
    Price              float64      `json:"price" validate:"required,min=0"`
    PriceType          PriceType    `json:"price_type" validate:"required,oneof=flat per_unit"`
    Currency           *string      `json:"currency,omitempty"` // default: EUR
}
```

#### Response

```go
// 201 Created
type ServiceResponse
```

#### Business Rules

1. Location must belong to provider's business
2. If `duration_type` = fixed: `duration_minutes` required
3. If `duration_type` = flexible: `time_unit_minutes`, `min_duration_minutes`, `max_duration_minutes` required
4. `max_duration_minutes` must be >= `min_duration_minutes`
5. Default currency: EUR
6. `display_order` auto-incremented per location

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | validation-error | Invalid duration configuration |
| 403 | forbidden | Location not owned |

---

### 8.3 GET /api/v1/services/{id}

**Description:** Get a specific service.

---

### 8.4 PUT /api/v1/services/{id}

**Description:** Update a service.

#### Request

```go
type UpdateServiceRequest struct {
    Name               *string  `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
    Description        *string  `json:"description,omitempty" validate:"omitempty,max=500"`
    DurationMinutes    *int     `json:"duration_minutes,omitempty" validate:"omitempty,min=15"`
    MinDurationMinutes *int     `json:"min_duration_minutes,omitempty" validate:"omitempty,min=15"`
    MaxDurationMinutes *int     `json:"max_duration_minutes,omitempty"`
    Price              *float64 `json:"price,omitempty" validate:"omitempty,min=0"`
    IsActive           *bool    `json:"is_active,omitempty"`
    DisplayOrder       *int     `json:"display_order,omitempty"`
}
```

#### Business Rules

1. Cannot change `duration_type` after creation
2. Cannot change `location_id` after creation

---

## 9. Workflow 6: Staff Management

### 9.1 GET /api/v1/staff

**Description:** List staff for a location.

#### Request

```go
type ListStaffQuery struct {
    LocationID uuid.UUID `form:"location_id" validate:"required,uuid"`
    PaginationParams
}
```

#### Response

```go
// 200 OK
type StaffListResponse = PaginatedList[StaffResponse]

type StaffResponse struct {
    ID         uuid.UUID `json:"id"`
    LocationID uuid.UUID `json:"location_id"`
    Name       string    `json:"name"`
    Role       *string   `json:"role,omitempty"`
    PhotoURL   *string   `json:"photo_url,omitempty"`
    IsActive   bool      `json:"is_active"`
    CreatedAt  time.Time `json:"created_at"`
    UpdatedAt  time.Time `json:"updated_at"`
}
```

---

### 9.2 POST /api/v1/staff

**Description:** Create a staff member.

#### Request

```go
type CreateStaffRequest struct {
    LocationID uuid.UUID `json:"location_id" validate:"required,uuid"`
    Name       string    `json:"name" validate:"required,min=1,max=100"`
    Role       *string   `json:"role,omitempty" validate:"omitempty,max=100"`
}
```

---

### 9.3 GET /api/v1/staff/{id}

### 9.4 PUT /api/v1/staff/{id}

---

## 10. Workflow 7: Equipment Management

### 10.1 GET /api/v1/equipment

#### Request

```go
type ListEquipmentQuery struct {
    LocationID uuid.UUID `form:"location_id" validate:"required,uuid"`
    PaginationParams
}
```

#### Response

```go
type EquipmentResponse struct {
    ID         uuid.UUID `json:"id"`
    LocationID uuid.UUID `json:"location_id"`
    Name       string    `json:"name"`
    Capacity   int       `json:"capacity"` // how many can be booked simultaneously
    IsActive   bool      `json:"is_active"`
    CreatedAt  time.Time `json:"created_at"`
    UpdatedAt  time.Time `json:"updated_at"`
}
```

---

### 10.2 POST /api/v1/equipment

#### Request

```go
type CreateEquipmentRequest struct {
    LocationID uuid.UUID `json:"location_id" validate:"required,uuid"`
    Name       string    `json:"name" validate:"required,min=1,max=100"`
    Capacity   *int      `json:"capacity,omitempty"` // default: 1
}
```

---

### 10.3 GET /api/v1/equipment/{id}

### 10.4 PUT /api/v1/equipment/{id}

---

## 11. Workflow 8: Availability Management

### 11.1 GET /api/v1/availability/slots

**Description:** Get available time slots for booking (public endpoint).

#### Request

```go
type GetSlotsQuery struct {
    ServiceID       uuid.UUID `form:"service_id" validate:"required,uuid"`
    Date            string    `form:"date" validate:"required,datetime=2006-01-02"`
    DurationMinutes *int      `form:"duration_minutes,omitempty"` // required for flexible
}
```

#### Response

```go
// 200 OK
type AvailableSlotsResponse struct {
    ServiceID       uuid.UUID  `json:"service_id"`
    Date            string     `json:"date"`
    DurationMinutes int        `json:"duration_minutes"`
    Slots           []TimeSlot `json:"slots"`
}

type TimeSlot struct {
    StartTime string `json:"start_time"` // "09:00"
    EndTime   string `json:"end_time"`   // "09:30"
    Available bool   `json:"available"`
}
```

#### Business Rules

1. Calculate slots based on:
   - Location operating hours
   - Staff/equipment availability
   - Existing bookings (exclude booked slots)
   - Service duration
2. For flexible services: `duration_minutes` required in request
3. Slots generated at 15-minute intervals
4. Only return slots for active services/locations

#### Auth Matrix

| Role | Access |
|------|--------|
| Public | Yes |

#### Query Pattern

1. SELECT services s JOIN locations l WHERE s.id = ? AND s.is_active AND l.is_active
2. SELECT location_availability WHERE location_id = ? AND day_of_week = ?
3. SELECT bookings/booking_items for the date (to exclude)
4. Calculate available slots in memory

---

### 11.2 GET /api/v1/availability/location/{id}

**Description:** Get location's operating hours.

#### Response

```go
type LocationAvailabilityResponse struct {
    LocationID uuid.UUID                `json:"location_id"`
    Schedule   []DayAvailability        `json:"schedule"`
}

type DayAvailability struct {
    DayOfWeek int    `json:"day_of_week"` // 0=Sunday, 1=Monday...
    StartTime string `json:"start_time"`  // "09:00"
    EndTime   string `json:"end_time"`    // "18:00"
    IsClosed  bool   `json:"is_closed"`
}
```

---

### 11.3 PUT /api/v1/availability/location/{id}

**Description:** Update location's operating hours.

#### Request

```go
type UpdateLocationAvailabilityRequest struct {
    Schedule []DayAvailabilityInput `json:"schedule" validate:"required,dive"`
}

type DayAvailabilityInput struct {
    DayOfWeek int     `json:"day_of_week" validate:"min=0,max=6"`
    StartTime *string `json:"start_time,omitempty"` // null = closed
    EndTime   *string `json:"end_time,omitempty"`
}
```

---

## 12. Workflow 9: Customer Booking

### 12.1 GET /api/v1/bookings

**Description:** List bookings for current customer.

#### Request

```go
type ListMyBookingsQuery struct {
    Status *BookingStatus `form:"status,omitempty"`
    PaginationParams
}
```

#### Response

```go
// 200 OK
type BookingListResponse = PaginatedList[BookingResponse]

type BookingResponse struct {
    ID          uuid.UUID       `json:"id"`
    LocationID  uuid.UUID       `json:"location_id"`
    UserID      uuid.UUID       `json:"user_id"`
    Status      BookingStatus   `json:"status"`
    TotalAmount float64         `json:"total_amount"`
    Currency    string          `json:"currency"`
    Notes       *string         `json:"notes,omitempty"`
    Items       []BookingItemResponse `json:"items"`
    Location    *LocationResponse     `json:"location,omitempty"` // included in list
    CreatedAt   time.Time       `json:"created_at"`
    UpdatedAt   time.Time       `json:"updated_at"`
}

type BookingItemResponse struct {
    ID              uuid.UUID         `json:"id"`
    ServiceID       uuid.UUID         `json:"service_id"`
    StartDatetime   time.Time         `json:"start_datetime"`
    EndDatetime     time.Time         `json:"end_datetime"`
    DurationMinutes int               `json:"duration_minutes"`
    Price           float64           `json:"price"`
    Status          BookingItemStatus `json:"status"`
    Service         *ServiceResponse  `json:"service,omitempty"`
}
```

#### Auth Matrix

| Role | Access |
|------|--------|
| Authenticated | Yes (own bookings only) |

---

### 12.2 POST /api/v1/bookings

**Description:** Create a new booking.

#### Request

```go
type CreateBookingRequest struct {
    LocationID uuid.UUID                `json:"location_id" validate:"required,uuid"`
    Items      []CreateBookingItemInput `json:"items" validate:"required,min=1,dive"`
    Notes      *string                  `json:"notes,omitempty" validate:"omitempty,max=500"`
}

type CreateBookingItemInput struct {
    ServiceID       uuid.UUID `json:"service_id" validate:"required,uuid"`
    StartDatetime   string    `json:"start_datetime" validate:"required,datetime=2006-01-02T15:04:05Z07:00"`
    DurationMinutes *int      `json:"duration_minutes,omitempty"` // required for flexible
}
```

#### Response

```go
// 201 Created
type BookingResponse
```

#### Business Rules

1. All services must belong to the specified location
2. All time slots must be available (not already booked)
3. For flexible services: `duration_minutes` required and within min/max
4. `end_datetime` calculated from `start_datetime` + duration
5. `total_amount` = sum of item prices
6. Initial status: `pending_payment`
7. EMIT `BookingCreated` event for notifications

#### Auth Matrix

| Role | Access |
|------|--------|
| Authenticated | Yes |

#### Errors

| Status | Code | When |
|--------|------|------|
| 400 | validation-error | Invalid input |
| 409 | slot-unavailable | Time slot already booked |

#### Query Pattern

1. SELECT services WHERE id IN (?) AND location_id = ?
2. SELECT bookings/booking_items for overlap check (FOR UPDATE - lock)
3. INSERT bookings
4. INSERT booking_items
5. EMIT BookingCreated

**Performance Note:** Overlap check requires index on `(service_id, start_datetime, end_datetime)` for booking_items.

---

### 12.3 GET /api/v1/bookings/{id}

**Description:** Get a specific booking.

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Customer | Yes | Own booking |
| Provider | Yes | Booking at own location |

---

### 12.4 POST /api/v1/bookings/{id}/cancel

**Description:** Cancel a booking.

#### Request

```go
type CancelBookingRequest struct {
    Reason *string `json:"reason,omitempty" validate:"omitempty,max=500"`
}
```

#### Response

```go
// 200 OK
type BookingResponse // with updated status
```

#### Business Rules

1. Can only cancel bookings with status: `pending_payment`, `confirmed`
2. Customer cancellation: status -> `cancelled_by_customer`
3. Provider cancellation: status -> `cancelled_by_provider`
4. EMIT `BookingCancelled` event
5. Cancellation policy enforcement (future): check time before appointment

#### Auth Matrix

| Role | Access | Condition |
|------|--------|-----------|
| Customer | Yes | Own booking |
| Provider | Yes | Booking at own location |

#### Errors

| Status | Code | When |
|--------|------|------|
| 409 | cannot-cancel | Booking already cancelled or completed |

---

### 12.5 GET /api/v1/bookings/provider

**Description:** List bookings for provider's locations.

#### Request

```go
type ListProviderBookingsQuery struct {
    LocationID *uuid.UUID     `form:"location_id,omitempty"`
    Status     *BookingStatus `form:"status,omitempty"`
    FromDate   *string        `form:"from_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
    ToDate     *string        `form:"to_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
    PaginationParams
}
```

#### Auth Matrix

| Role | Access |
|------|--------|
| Provider | Yes (own locations only) |

---

## 13. Workflow 10: Search

### 13.1 GET /api/v1/search/locations

**Description:** Public search for locations/businesses.

#### Request

```go
type SearchLocationsQuery struct {
    Q         *string           `form:"q,omitempty"`        // text search
    Category  *BusinessCategory `form:"category,omitempty"`
    City      *string           `form:"city,omitempty"`
    Lat       *float64          `form:"lat,omitempty"`
    Lng       *float64          `form:"lng,omitempty"`
    RadiusKM  *float64          `form:"radius_km,omitempty"` // default: 10
    PaginationParams
}
```

#### Response

```go
// 200 OK
type LocationSearchResponse = PaginatedList[LocationSearchItem]

type LocationSearchItem struct {
    ID            uuid.UUID  `json:"id"`
    Name          string     `json:"name"`
    Address       string     `json:"address"`
    City          string     `json:"city"`
    Lat           *float64   `json:"lat,omitempty"`
    Lng           *float64   `json:"lng,omitempty"`
    DistanceKM    *float64   `json:"distance_km,omitempty"` // if lat/lng provided
    Business      BusinessSummary `json:"business"`
    ServicesCount int        `json:"services_count"`
}

type BusinessSummary struct {
    ID       uuid.UUID        `json:"id"`
    Name     string           `json:"name"`
    Category BusinessCategory `json:"category"`
    LogoURL  *string          `json:"logo_url,omitempty"`
}
```

#### Business Rules

1. Only return active locations with active businesses
2. Text search on: business name, location name, service names
3. If lat/lng provided: calculate distance, sort by distance
4. If city provided: filter by city

#### Auth Matrix

| Role | Access |
|------|--------|
| Public | Yes |

#### Query Pattern

1. Full-text search or ILIKE on relevant columns
2. If lat/lng: use PostGIS ST_Distance or Haversine formula
3. JOIN businesses, filter is_active
4. COUNT services for each location

**Performance Note:** Add GIN index for text search, spatial index if using PostGIS.

---

## 14. Workflow 11: Payment Webhook

### 14.1 POST /api/v1/payments/webhook

**Description:** Handle Paysera payment callback.

#### Request

```go
// Paysera sends form-encoded data
type PayseraWebhookRequest struct {
    Data string `form:"data"` // base64-encoded payment data
    SS1  string `form:"ss1"`  // signature
    SS2  string `form:"ss2"`  // signature
}
```

#### Response

```go
// 200 OK with text "OK"
```

#### Business Rules

1. Verify signature using Paysera credentials
2. Decode and parse payment data
3. Find booking by order_id
4. If payment successful: update booking status to `confirmed`
5. If payment failed: update status or leave as `pending_payment`
6. EMIT `PaymentReceived` event
7. Idempotent: check if already processed

#### Auth Matrix

| Role | Access |
|------|--------|
| Paysera (IP whitelist + signature) | Yes |

#### Query Pattern

1. Verify signature
2. SELECT bookings WHERE id = ? (from order_id)
3. Check booking.status (idempotency)
4. UPDATE bookings SET status = 'confirmed'
5. EMIT PaymentReceived

---

## 15. Error Catalogue

| Slug | HTTP | Title | When |
|------|------|-------|------|
| `validation-error` | 400 | Validation failed | Field validation errors |
| `invalid-credentials` | 401 | Invalid credentials | Wrong email/password |
| `unauthorized` | 401 | Authentication required | Missing/invalid token |
| `invalid-refresh-token` | 401 | Invalid refresh token | Expired/revoked token |
| `invalid-token` | 400 | Invalid token | Email verification token |
| `forbidden` | 403 | Insufficient permissions | Not authorized for resource |
| `provider-required` | 403 | Provider account required | Non-provider accessing provider endpoints |
| `not-found` | 404 | Resource not found | Entity doesn't exist |
| `email-already-exists` | 409 | Email already registered | Duplicate email |
| `already-provider` | 409 | Already a provider | Duplicate provider creation |
| `slot-unavailable` | 409 | Time slot unavailable | Booking conflict |
| `cannot-cancel` | 409 | Cannot cancel booking | Already cancelled/completed |
| `email-already-verified` | 400 | Email already verified | Resend verification |
| `oauth-failed` | 400 | OAuth authentication failed | OAuth error |
| `rate-limited` | 429 | Too many requests | Rate limit exceeded |
| `internal-error` | 500 | Internal server error | Unexpected error |

---

## 16. Audit Events

Per NFR requirements, these events must be logged:

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `user.registered` | Registration | user_id |
| `user.login` | Login | user_id, method (email/oauth) |
| `user.logout` | Logout | user_id |
| `user.email_verified` | Email verification | user_id |
| `provider.created` | Become provider | user_id, provider_id |
| `business.created` | Create business | provider_id, business_id |
| `business.updated` | Update business | provider_id, business_id |
| `location.created` | Create location | business_id, location_id |
| `location.updated` | Update location | business_id, location_id |
| `service.created` | Create service | location_id, service_id |
| `service.updated` | Update service | location_id, service_id |
| `booking.created` | Create booking | user_id, booking_id, location_id |
| `booking.cancelled` | Cancel booking | user_id, booking_id, cancelled_by |
| `booking.confirmed` | Payment received | booking_id |

**Format:** Structured JSON logs via Cloud Logging. No PII in logs.

---

## 17. SPEC-TODOs

| # | Item | Must Resolve Before |
|---|------|---------------------|
| 1 | Paysera webhook signature verification method | Payment integration |
| 2 | Email verification token format (JWT vs DB) | Implementation |
| 3 | Cancellation policy (time-based rules) | Business logic |
| 4 | Staff/equipment assignment to booking items | Booking flow |
| 5 | File upload endpoints for logos/photos | Media handling |

---

## 18. Appendix: Database Indexes

**Required indexes for performance:**

```sql
-- Users
CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));

-- Refresh tokens
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- Businesses
CREATE INDEX idx_businesses_provider ON businesses (provider_id);

-- Locations
CREATE INDEX idx_locations_business ON locations (business_id);
CREATE INDEX idx_locations_city ON locations (city);
-- For geo search (if using PostGIS):
-- CREATE INDEX idx_locations_geo ON locations USING GIST (geography(ST_MakePoint(lng, lat)));

-- Services
CREATE INDEX idx_services_location ON services (location_id);

-- Bookings
CREATE INDEX idx_bookings_user ON bookings (user_id);
CREATE INDEX idx_bookings_location ON bookings (location_id);
CREATE INDEX idx_bookings_status ON bookings (status);

-- Booking items (critical for availability check)
CREATE INDEX idx_booking_items_service_time ON booking_items (service_id, start_datetime, end_datetime);

-- Full-text search
CREATE INDEX idx_businesses_name_gin ON businesses USING GIN (to_tsvector('english', name));
CREATE INDEX idx_locations_name_gin ON locations USING GIN (to_tsvector('english', name));
CREATE INDEX idx_services_name_gin ON services USING GIN (to_tsvector('english', name));
```

---

*Generated by backend-spec skill from BRD, NFR, and HLD documents.*
