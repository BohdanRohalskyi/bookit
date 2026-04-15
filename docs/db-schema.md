# Database Schema — Table Relations

> Example: **Glamour Hair Salon** (single business, two branches)

```mermaid
erDiagram

  %% ─── Auth ────────────────────────────────────────────────────────────────

  users {
    uuid id PK
    string email
    string name
    string phone
    string password_hash
    bool email_verified
  }

  refresh_tokens {
    uuid id PK
    uuid user_id FK
    string token_hash
    timestamptz expires_at
  }

  auth_tokens {
    uuid id PK
    uuid user_id FK
    string token_type
    string token_hash
    string ip_address
    timestamptz expires_at
    timestamptz used_at
  }

  users ||--o{ refresh_tokens  : ""
  users ||--o{ auth_tokens     : ""

  %% ─── Identity ────────────────────────────────────────────────────────────

  providers {
    uuid id PK
    uuid user_id FK
    string status
  }

  users ||--|| providers : "becomes"

  %% ─── Business ────────────────────────────────────────────────────────────
  %% Example: "Glamour Hair Salon" (category: beauty)

  businesses {
    uuid id PK
    uuid provider_id FK
    string name
    string category
    string logo_url
    bool is_active
  }

  providers ||--o{ businesses : "owns"

  %% ─── Branch ──────────────────────────────────────────────────────────────
  %% Example: "Main Street" and "City Center"

  branches {
    uuid id PK
    uuid business_id FK
    string name
    string address
    string city
    string timezone
    string phone
    bool is_active
  }

  businesses ||--o{ branches : "has"

  %% ─── Branch schedule ─────────────────────────────────────────────────────

  schedules {
    uuid id PK
    uuid branch_id FK
  }

  schedule_days {
    uuid id PK
    uuid schedule_id FK
    int day_of_week
    bool is_open
    time open_time
    time close_time
  }

  schedule_exceptions {
    uuid id PK
    uuid schedule_id FK
    date date
    bool is_closed
    time open_time
    time close_time
    string reason
  }

  branch_photos {
    uuid id PK
    uuid branch_id FK
    string url
    int display_order
  }

  branches       ||--||    schedules          : "has"
  schedules      ||--o{    schedule_days      : "7 days"
  schedules      ||--o{    schedule_exceptions: "overrides"
  branches       ||--o{    branch_photos      : "gallery"

  %% ─── Business catalog (defined once, shared across branches) ─────────────
  %% Example equipment:  "Styling Chair", "Hair Washing Station"
  %% Example staff roles: "Hair Stylist", "Colorist"
  %% Example services:    "Haircut", "Hair Coloring", "Blow Dry"

  equipment {
    uuid id PK
    uuid business_id FK
    string name
  }

  staff_roles {
    uuid id PK
    uuid business_id FK
    string job_title
  }

  services {
    uuid id PK
    uuid business_id FK
    string name
    string description
    int duration_minutes
    decimal price
    string currency
  }

  businesses ||--o{ equipment   : "catalog"
  businesses ||--o{ staff_roles : "catalog"
  businesses ||--o{ services    : "catalog"

  %% ─── Service resource requirements ──────────────────────────────────────
  %% Example: "Haircut" needs 1× Styling Chair + 1× Hair Stylist

  service_equipment_requirements {
    uuid id PK
    uuid service_id FK
    uuid equipment_id FK
    int quantity_needed
  }

  service_staff_requirements {
    uuid id PK
    uuid service_id FK
    uuid staff_role_id FK
    int quantity_needed
  }

  services   ||--o{ service_equipment_requirements : "needs"
  equipment  ||--o{ service_equipment_requirements : "used by"
  services   ||--o{ service_staff_requirements     : "needs"
  staff_roles ||--o{ service_staff_requirements    : "used by"

  %% ─── Branch configuration (pivot — links catalog to a branch) ────────────
  %% Example: Main Street branch
  %%   branch_equipment:  Styling Chair ×3, Hair Washing Station ×2
  %%   branch_staff_roles: Hair Stylist ×2, Colorist ×1
  %%   branch_services:   Haircut ✓, Hair Coloring ✓, Blow Dry ✓

  branch_equipment {
    uuid id PK
    uuid branch_id FK
    uuid equipment_id FK
    int quantity
  }

  branch_staff_roles {
    uuid id PK
    uuid branch_id FK
    uuid staff_role_id FK
    int quantity
  }

  branch_services {
    uuid id PK
    uuid branch_id FK
    uuid service_id FK
    bool is_active
  }

  branches    ||--o{ branch_equipment   : "has available"
  equipment   ||--o{ branch_equipment   : "stocked at"
  branches    ||--o{ branch_staff_roles : "staffed with"
  staff_roles ||--o{ branch_staff_roles : "present at"
  branches    ||--o{ branch_services    : "offers"
  services    ||--o{ branch_services    : "offered at"
```

---

## Hair salon example walkthrough

| Table | Row |
|-------|-----|
| `users` | Maria Jonaitis |
| `providers` | Maria as provider |
| `businesses` | Glamour Hair Salon · beauty |
| `branches` | Main Street · City Center |
| `equipment` | Styling Chair · Hair Washing Station _(business-level)_ |
| `staff_roles` | Hair Stylist · Colorist _(business-level)_ |
| `services` | Haircut · Hair Coloring · Blow Dry _(business-level)_ |
| `service_equipment_requirements` | Haircut → 1× Styling Chair |
| `service_staff_requirements` | Haircut → 1× Hair Stylist |
| `branch_equipment` | Main Street → 3× Styling Chair, 2× Washing Station |
| `branch_staff_roles` | Main Street → 2× Hair Stylist, 1× Colorist |
| `branch_services` | Main Street → Haircut ✓ · Hair Coloring ✓ · Blow Dry ✓ |
| `schedules` + `schedule_days` | Main Street: Mon–Fri 09:00–19:00, Sat 10:00–17:00 |
| `schedule_exceptions` | Main Street: 2026-12-25 closed (Christmas) |
| `branch_photos` | Main Street: 4 interior photos |
