# PRD — Bookit

> **Product Requirements Document**
>
> Derived from: BRD-Bookit-20260327.md

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document version | v2.3 |
| Created date | 2026-03-27 |
| Status | Draft |
| BRD Reference | BRD-Bookit-20260327.md |
| MVP Target | June 30, 2026 |

---

## 1. Product Overview

### 1.1 Vision

Bookit is a unified booking platform that enables service providers in beauty, sport, and pet care to manage their appointments, schedules, and client relationships — while giving customers an easy way to discover and book services.

### 1.2 Target Users

| User Type | Description | Priority |
|-----------|-------------|----------|
| **Service Providers** | Solo practitioners and small teams offering beauty, sport, or pet care services | Primary (MVP) |
| **End Customers** | Individuals seeking to book services | Secondary (MVP) |

### 1.3 MVP Scope

| Feature | MVP | Post-MVP |
|---------|-----|----------|
| Provider registration | Yes | |
| Business management (multi-business) | Yes | |
| Location management (multi-location) | Yes | |
| Service & pricing management (per location) | Yes | |
| Equipment management (per location) | Yes | |
| Staff management (per location) | Yes | |
| Schedule/availability management (per location) | Yes | |
| Customer registration & accounts | Yes | |
| Customer booking flow (login required) | Yes | |
| Payments (abstracted, mock for MVP) | Yes | |
| Notifications (email) | Yes | |
| SMS notifications | | Yes |
| Mobile apps (iOS/Android) | | Yes |
| Multi-location support | | Yes |
| Team/staff management | | Yes |
| AI agent/assistant integration | | Yes |

---

## 2. User Personas

### 2.1 Provider Persona: "Solo Sarah"

- **Who**: Independent hair stylist, 32, runs her own small salon
- **Goals**: Fill her calendar, reduce no-shows, spend less time on admin
- **Pain points**: Misses calls when busy with clients, double-bookings, no client history
- **Tech comfort**: Uses smartphone daily, comfortable with basic apps

### 2.2 Provider Persona: "Gym Owner Greg"

- **Who**: Personal trainer who owns a small fitness studio, 40, has 3 trainers
- **Goals**: Manage multiple trainer schedules, grow client base, track bookings
- **Pain points**: WhatsApp chaos, manual schedule coordination, no visibility
- **Tech comfort**: Moderate, uses Google Calendar and spreadsheets

### 2.3 Customer Persona: "Booking Betty"

- **Who**: Professional, 28, needs regular beauty and fitness appointments
- **Goals**: Book quickly, get reminders, find new services nearby
- **Pain points**: Phone tag with providers, forgets appointments, hard to compare options
- **Tech comfort**: High, books everything online

---

## 3. Feature Requirements

### 3.1 Provider Registration & Business Management

#### User Stories — Provider Account

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| P-001 | Provider | register with email and password | I can create my account | Must |
| P-002 | Provider | verify my email address | my account is secured | Must |
| P-003 | Provider | manage multiple businesses | I can run different brands | Must |
| P-004 | Provider | switch between my businesses | I can manage each one separately | Must |

#### User Stories — Business & Location

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| BL-001 | Provider | create a business with name and category | customers know what I offer | Must |
| BL-002 | Provider | add a logo and cover image to my business | my brand looks professional | Should |
| BL-003 | Provider | add locations to my business | customers can find where I operate | Must |
| BL-004 | Provider | set each location's address and contact info | customers know where to go | Must |
| BL-005 | Provider | manage multiple locations per business | I can expand to new areas | Must |
| BL-006 | Provider | switch between locations | I can manage each one separately | Must |
| BL-007 | Provider | edit business and location details | I can keep information up to date | Must |
| BL-008 | Provider | disable a location temporarily | I can handle closures without deleting | Should |

#### Acceptance Criteria: P-001 (Provider Registration)

```gherkin
GIVEN I am a new provider
WHEN I navigate to the registration page
THEN I see registration options:
  - "Continue with Google" button
  - "Continue with Facebook" button
  - "Continue with Paysera" button
  - Email/password form with:
    - Email field (required)
    - Password field (required, min 8 chars)
  - Terms acceptance checkbox

GIVEN I click "Continue with Google"
WHEN Google OAuth completes successfully
THEN my provider account is created
AND I am redirected to Business Setup Wizard
AND no email verification is needed (Google verified)
```

#### Acceptance Criteria: BL-001 (Business Setup)

```gherkin
GIVEN I am a newly registered provider (or adding another business)
WHEN I start the Business Setup Wizard
THEN I enter:
  - Business name (required)
  - Business category (beauty/sport/pet care)
  - Business description (optional)
  - Logo (optional)

GIVEN I have created a business
THEN I am prompted to add my first location
```

#### Acceptance Criteria: BL-003 (Location Setup)

```gherkin
GIVEN I am adding a location to my business
WHEN I fill out the location form
THEN I enter:
  - Location name (required, e.g., "Downtown", "Main Street")
  - Address (required)
  - City (required)
  - Country (required)
  - Phone (optional)
  - Email (optional)

GIVEN I have created a location
THEN I can add services, staff, and equipment to that location
AND the location appears in customer search results

GIVEN I choose email/password registration
WHEN I submit the form with valid data
THEN my account is created
AND I receive a verification email
AND I am redirected to email verification pending page

GIVEN I have submitted invalid data
WHEN I submit the form
THEN I see specific error messages for invalid fields
AND my account is NOT created
```

#### Acceptance Criteria: P-003 (Business Profile)

```gherkin
GIVEN I am a logged-in provider
WHEN I navigate to my profile settings
THEN I can edit:
  - Business name (required, max 100 chars)
  - Business description (optional, max 1000 chars)
  - Business category (required, single select)
  - Sub-categories (optional, multi-select based on category)
  - Profile photo (optional, max 5MB, jpg/png)
  - Cover image (optional, max 10MB, jpg/png)
  - Address (required for in-person services)
  - Phone number (optional)
  - Website URL (optional)

GIVEN I have updated my profile
WHEN I save changes
THEN my public profile reflects the updates immediately
```

---

### 3.2 Service & Pricing Management

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| S-001 | Provider | add a new service with name, description, and duration | customers know what I offer | Must |
| S-002 | Provider | set a price for each service | customers know the cost | Must |
| S-003 | Provider | choose fixed or flexible duration for a service | I can support both appointments and rentals | Must |
| S-004 | Provider | set hourly/per-unit pricing for flexible services | customers pay based on how long they book | Must |
| S-005 | Provider | set min/max duration for flexible services | I can control booking length (e.g., 1-4 hours) | Must |
| S-006 | Provider | organize services into categories | my offerings are easy to browse | Should |
| S-007 | Provider | set different prices for service variations | I can offer different options (e.g., short/long haircut) | Should |
| S-008 | Provider | temporarily disable a service | I can pause offerings without deleting | Should |
| S-009 | Provider | delete a service | I can remove services I no longer offer | Must |
| S-010 | Provider | reorder my services | most popular services appear first | Could |

#### Service Duration Types

**Provider chooses duration type per service** — available across all verticals (beauty, sport, pet care). This gives providers flexibility to offer both traditional appointments and rental/time-based services.

| Type | Use Case | Pricing | Examples |
|------|----------|---------|----------|
| **Fixed** | Appointments with set duration | Flat price per service | Haircut (45 min), Personal training session (60 min), Dog grooming (90 min) |
| **Flexible** | Customer chooses duration within min/max | Price per time unit | Tennis court rental (1-4 hrs), Salon chair rental (2-8 hrs), Pet daycare (4-10 hrs) |

#### Examples by Vertical

| Vertical | Fixed Duration Examples | Flexible Duration Examples |
|----------|------------------------|---------------------------|
| **Beauty** | Haircut, Manicure, Facial, Massage | Chair/station rental, Room rental, Spa day package |
| **Sport** | Personal training session, Group class, Swimming lesson | Court rental, Gym room, Pool lane, Equipment rental |
| **Pet Care** | Grooming, Vet checkup, Training session | Daycare, Boarding, Pet sitting, Kennel rental |

#### Acceptance Criteria: S-001 (Add Service)

```gherkin
GIVEN I am a logged-in provider
WHEN I navigate to Services management
THEN I see a list of my existing services (or empty state)
AND I see an "Add Service" button

GIVEN I click "Add Service"
WHEN the form appears
THEN I can enter:
  - Service name (required, max 100 chars)
  - Description (optional, max 500 chars)
  - Duration type (required): "Fixed" or "Flexible"
  - Category (optional, for organization)
  - Equipment assignment (optional)

# If Duration Type = Fixed:
  - Duration (required, in minutes: 15/30/45/60/90/120/custom)
  - Price (required, flat rate)

# If Duration Type = Flexible:
  - Time unit (required: 30 min / 1 hour)
  - Price per unit (required, e.g., €20/hour)
  - Minimum duration (required, e.g., 1 hour)
  - Maximum duration (required, e.g., 4 hours)

GIVEN I have filled required fields
WHEN I save the service
THEN the service appears in my service list
AND the service is visible on my public profile
AND customers can book this service
```

#### Acceptance Criteria: S-003 (Flexible Duration Booking)

```gherkin
# Works for ANY vertical — provider chooses duration type per service

GIVEN I am a customer viewing a flexible-duration service
WHEN I click "Book Now"
THEN I see:
  - Date picker
  - Start time picker (available slots)
  - Duration selector (based on min/max configured by provider)
  - Calculated total price (duration × price per unit)

# Example: Sport — Tennis Court
GIVEN "Tennis Court Rental" is €15/hour with min 1h, max 4h
AND I select 3 hours starting at 10:00
THEN the total price shows €45
AND the booking reserves 10:00-13:00

# Example: Beauty — Chair Rental
GIVEN "Salon Chair Rental" is €10/hour with min 2h, max 8h
AND I select 4 hours starting at 09:00
THEN the total price shows €40
AND the booking reserves 09:00-13:00

# Example: Pet Care — Daycare
GIVEN "Dog Daycare" is €5/hour with min 4h, max 10h
AND I select 6 hours starting at 08:00
THEN the total price shows €30
AND the booking reserves 08:00-14:00

# Equipment capacity check (applies to all)
GIVEN the equipment has capacity 2
AND one slot is booked 10:00-12:00
WHEN I try to book 11:00-14:00
THEN the slot is available (second capacity unit)
AND if both are booked, 11:00 shows as unavailable
```

---

### 3.3 Schedule & Availability Management

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| A-001 | Provider | set my regular weekly working hours | customers see when I'm available | Must |
| A-002 | Provider | set different hours for different days | I can customize my schedule | Must |
| A-003 | Provider | block specific dates/times | I can mark vacations or personal time | Must |
| A-004 | Provider | set buffer time between appointments | I have prep/cleanup time | Should |
| A-005 | Provider | view my calendar with all bookings | I can see my schedule at a glance | Must |
| A-006 | Provider | manually add a booking | I can record phone/walk-in bookings | Should |
| A-007 | Provider | edit or cancel existing bookings | I can handle changes | Must |

#### Acceptance Criteria: A-001 (Working Hours)

```gherkin
GIVEN I am a logged-in provider
WHEN I navigate to Availability settings
THEN I see a weekly schedule grid with:
  - All 7 days of the week
  - Toggle to enable/disable each day
  - Start time and end time for each enabled day
  - Option to add multiple time slots per day (e.g., 9-12, 14-18)

GIVEN I have set Monday 9:00-17:00
WHEN a customer views my booking page on Monday
THEN they see available slots within 9:00-17:00
AND they cannot book outside those hours

GIVEN I have disabled Sunday
WHEN a customer tries to book Sunday
THEN no time slots are available for Sunday
```

#### Acceptance Criteria: A-003 (Block Time)

```gherkin
GIVEN I am viewing my calendar
WHEN I click on a date/time slot
THEN I can choose to "Block this time"
AND I can enter an optional reason (personal use only)

GIVEN I have blocked March 30, 2026 all day
WHEN a customer views my availability for March 30
THEN no time slots are available
AND existing bookings for that day are NOT automatically cancelled
AND I see a warning if there are existing bookings
```

---

### 3.4 Customer Booking Flow

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| B-001 | Customer | browse providers by category | I can find the type of service I need | Must |
| B-002 | Customer | search for providers by name or location | I can find specific providers | Must |
| B-003 | Customer | view a provider's profile and services | I can decide if they're right for me | Must |
| B-004 | Customer | see available time slots for a service | I can choose a convenient time | Must |
| B-005 | Customer | register an account with email and password | I can make bookings and track my history | Must |
| B-006 | Customer | log in to my account | I can access my bookings | Must |
| B-007 | Customer | book a single service | I can secure my time slot | Must |
| B-008 | Customer | add multiple services to one booking | I can book haircut + manicure together | Must |
| B-009 | Customer | see total price for all services in my booking | I know what I'll pay | Must |
| B-010 | Customer | receive a booking confirmation | I have proof of my appointment | Must |
| B-011 | Customer | view all my upcoming and past bookings | I can track my appointment history | Must |
| B-012 | Customer | cancel my booking | I can change my plans | Must |
| B-013 | Customer | reschedule my booking | I can change to a different time | Should |
| B-014 | Customer | update my profile information | my contact details stay current | Should |

#### Acceptance Criteria: B-004 (View Available Slots)

```gherkin
GIVEN I am viewing a provider's service
WHEN I click "Book Now"
THEN I see a calendar interface showing:
  - Available dates (next 30 days by default)
  - Unavailable dates grayed out

GIVEN I select a date
THEN I see available time slots for that date
AND slots are based on:
  - Provider's working hours
  - Service duration
  - Existing bookings
  - Blocked times
  - Buffer times (if configured)

GIVEN a slot shows "10:00 AM"
WHEN the service is 60 minutes
THEN booking that slot reserves 10:00-11:00
AND 10:30 is NOT shown as available (overlapping)
```

#### Acceptance Criteria: B-005 (Customer Registration)

```gherkin
GIVEN I am a new customer
WHEN I navigate to the registration page
THEN I see registration options:
  - "Continue with Google" button
  - "Continue with Facebook" button
  - "Continue with Paysera" button
  - Email/password form with:
    - Name (required)
    - Email (required)
    - Password (required, min 8 chars)
    - Phone (required)
  - Terms acceptance checkbox

GIVEN I click "Continue with Google"
WHEN Google OAuth completes successfully
THEN my account is created with Google profile info (name, email)
AND I am prompted to enter phone number (required for bookings)
AND no email verification is needed (Google verified)

GIVEN I click "Continue with Paysera"
WHEN Paysera OAuth completes successfully
THEN my account is created with Paysera profile info
AND I am prompted to complete missing profile fields
AND no email verification is needed (Paysera verified)

GIVEN I choose email/password registration
WHEN I submit the form with valid data
THEN my account is created
AND I receive a verification email
AND I am redirected to email verification pending page

GIVEN I have verified my email (or used social login)
THEN I can log in and make bookings
```

#### Acceptance Criteria: B-007 (Book Single Service)

```gherkin
GIVEN I am a logged-in customer
AND I have selected a service and time slot
WHEN I proceed to confirm booking
THEN I see a booking summary with:
  - Service name, duration, price
  - Selected time slot
  - Equipment (auto-assigned by system, displayed for info)
  - My pre-filled contact info
  - "Add another service" button
  - Notes field (optional)
  - Total price
  - Proceed to payment button

GIVEN I am NOT logged in
WHEN I try to book an appointment
THEN I am redirected to login page
AND after login I return to the booking flow

# Equipment auto-assignment
GIVEN "Tennis Lesson" requires "Tennis Court" (capacity 2)
AND Court #1 is booked at 10:00, Court #2 is free
WHEN I select 10:00
THEN system auto-assigns Court #2
AND I see "Equipment: Tennis Court #2" in my booking summary
AND I cannot change the equipment assignment
```

#### Acceptance Criteria: B-008 (Multi-Service Booking)

```gherkin
GIVEN I have added "Haircut" (45 min, €35) to my booking starting at 10:00
WHEN I click "Add another service"
THEN I see the provider's other services
AND each service shows if it's available right after my current booking

GIVEN I select "Manicure" (60 min, €50)
THEN it is added to my booking starting at 10:45 (after haircut ends)
AND the booking summary shows:
  - Haircut: 10:00-10:45, €35
  - Manicure: 10:45-11:45, €50
  - Total: €85

GIVEN I have multiple services in my booking
WHEN I remove one service
THEN subsequent services shift their start times accordingly
AND the total price is recalculated

GIVEN I proceed to payment
WHEN payment succeeds
THEN ONE booking is created with multiple BookingItems
AND all required equipment is reserved for each service
AND I receive one confirmation email listing all services
```

#### Acceptance Criteria: B-009 (Multi-Equipment Service)

```gherkin
GIVEN "Full Spa Package" requires Massage Room + Facial Room + Relaxation Lounge
WHEN I try to book this service
THEN the system checks availability of ALL required equipment
AND the slot is only available if ALL equipment is free

GIVEN Massage Room is booked at 14:00
WHEN I try to book "Full Spa Package" at 14:00
THEN the slot is unavailable
AND I see a message indicating equipment conflict
```

#### Acceptance Criteria: B-012 (Cancel Booking)

```gherkin
GIVEN I am a logged-in customer with a confirmed booking
WHEN I navigate to "My Bookings"
THEN I see my upcoming bookings
AND each booking has a "Cancel" button

GIVEN I click "Cancel" on a booking
THEN I am asked to confirm cancellation
AND optionally provide a reason

GIVEN I confirm cancellation
THEN the booking status changes to "Cancelled"
AND the time slot becomes available again
AND the provider receives a cancellation notification
AND I receive a cancellation confirmation email
AND the booking moves to my cancelled/past bookings
```

---

### 3.5 Notifications & Reminders

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| N-001 | Provider | receive email notification when I get a new booking | I know immediately about new appointments | Must |
| N-002 | Provider | receive notification when a booking is cancelled | I know my schedule changed | Must |
| N-003 | Customer | receive booking confirmation email | I have appointment details | Must |
| N-004 | Customer | receive reminder email before my appointment | I don't forget my booking | Must |
| N-005 | Provider | configure reminder timing | reminders suit my business needs | Should |
| N-006 | Customer | receive cancellation confirmation | I know my booking was cancelled | Must |

#### Acceptance Criteria: N-004 (Customer Reminder)

```gherkin
GIVEN I have a confirmed booking for tomorrow at 10:00 AM
WHEN it is 24 hours before my appointment (today 10:00 AM)
THEN I receive a reminder email containing:
  - Provider name
  - Service name
  - Date and time
  - Location/address
  - Link to cancel or reschedule
  - Link to add to calendar

GIVEN the provider has configured 48-hour reminders
THEN I receive the reminder 48 hours before instead
```

---

### 3.6 Equipment Management

**Equipment** represents physical resources that services can be booked on — tennis courts, nail tables, massage rooms, grooming stations, etc. Equipment enables providers to manage resource capacity and prevent double-booking of limited resources.

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| E-001 | Provider | add equipment units with name and description | I can define my bookable resources (e.g., "Court #1", "Court #2") | Must |
| E-002 | Provider | group equipment units logically | I can organize similar resources (e.g., all tennis courts) | Should |
| E-003 | Provider | assign services to specific equipment | customers book the right resource | Must |
| E-004 | Provider | set availability hours per equipment | each resource has its own schedule | Should |
| E-005 | Provider | temporarily disable equipment | I can mark resources under maintenance | Should |
| E-006 | Provider | view equipment utilization | I can see how resources are being used | Could |
| E-007 | Customer | see what equipment will be used for my booking | I know what resource I'm getting | Should |
| E-008 | System | auto-assign available equipment when booking is made | resources are allocated without customer intervention | Must |

#### Acceptance Criteria: E-001 (Add Equipment)

```gherkin
GIVEN I am a logged-in provider
WHEN I navigate to Equipment management
THEN I see a list of my existing equipment (or empty state)
AND I see an "Add Equipment" button

GIVEN I click "Add Equipment"
WHEN the form appears
THEN I can enter:
  - Equipment name (required, max 100 chars)
  - Description (optional, max 500 chars)
  - Capacity (required, default 1, how many simultaneous bookings)
  - Photo (optional)

GIVEN I have filled required fields
WHEN I save the equipment
THEN the equipment appears in my equipment list
```

#### Acceptance Criteria: E-003 (Assign Services to Equipment)

```gherkin
GIVEN I am editing a service
WHEN I view the service form
THEN I see an "Equipment" field (optional multi-select)
AND I can select which equipment this service requires

GIVEN I have assigned "Tennis Court" to "Tennis Lesson" service
WHEN a customer books "Tennis Lesson"
THEN the system checks availability of "Tennis Court"
AND if capacity is reached, the time slot is unavailable

GIVEN "Tennis Court" has capacity 2
AND both slots are booked for 10:00 AM
WHEN another customer tries to book "Tennis Lesson" at 10:00 AM
THEN no slots are available at that time for that service
```

#### Equipment Examples by Vertical

| Vertical | Equipment Examples |
|----------|-------------------|
| **Beauty** | Nail table, Hair station, Massage room, Facial room |
| **Sport** | Tennis court, Squash court, Gym equipment, Pool lane, Training room |
| **Pet Care** | Grooming table, Bathing station, Kennel, Exam room |

#### Equipment Assignment Model

**Key principle**: Provider configures capacity, system counts bookings, customer does NOT choose.

| Step | Who | Action |
|------|-----|--------|
| 1. Setup | Provider | Creates equipment with capacity (e.g., "Tennis Court", capacity: 3) |
| 2. Config | Provider | Assigns equipment to service (e.g., "Tennis Lesson" requires "Tennis Court") |
| 3. Booking | System | Checks if bookings count < capacity, assigns equipment_id |
| 4. Display | System | Shows equipment name in booking confirmation |

```
Example: Customer books "Tennis Lesson" at 10:00

1. System checks ServiceEquipment → "Tennis Court" required
2. System counts concurrent BookingItems using "Tennis Court" at 10:00 = 2
3. System checks capacity = 3
4. 2 < 3 → Available, creates BookingItem with equipment_id = "Tennis Court"
5. Customer sees: "Tennis Lesson, 10:00, Tennis Court"
```

**Simplified tracking:**
- No individual unit tracking (Unit #1 vs #2)
- Capacity = how many concurrent bookings allowed
- System just counts and compares

---

### 3.7 Staff Management

**Staff** represents personnel who provide services — barbers, trainers, therapists, etc.

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| ST-001 | Provider | add staff members with name and role | I can assign them to services | Must |
| ST-002 | Provider | set working hours for each staff member | customers can only book when staff is available | Must |
| ST-003 | Provider | assign staff to specific services | only qualified staff appear for each service | Must |
| ST-004 | Provider | temporarily disable a staff member | I can handle vacations or sick leave | Should |
| ST-005 | Provider | view staff schedules and bookings | I can manage my team's workload | Must |
| ST-006 | Customer | see which staff member will serve me | I know who I'm booking with | Should |
| ST-007 | System | auto-assign available staff when booking | resources are allocated without customer intervention | Must |

#### Acceptance Criteria: ST-001 (Add Staff)

```gherkin
GIVEN I am a logged-in provider
WHEN I navigate to Staff management
THEN I see a list of my existing staff (or empty state)
AND I see an "Add Staff" button

GIVEN I click "Add Staff"
WHEN the form appears
THEN I can enter:
  - Name (required, e.g., "John Smith")
  - Role (optional, e.g., "Senior Barber", "Trainer")
  - Description (optional)
  - Photo (optional)

GIVEN I have filled required fields
WHEN I save the staff member
THEN they appear in my staff list
AND I can assign them to services
```

#### Acceptance Criteria: ST-003 (Assign Staff to Services)

```gherkin
GIVEN I am editing a service
WHEN I view the service form
THEN I see a "Staff" field (multi-select)
AND I can select which staff members can perform this service

GIVEN "Haircut by Senior Barber" has only "John" assigned
WHEN a customer books this service
THEN John's availability is checked
AND if John is not available, the slot is unavailable

GIVEN "Standard Haircut" has "John" and "Sarah" assigned
WHEN a customer books at 10:00
AND John is booked but Sarah is free
THEN Sarah is auto-assigned
AND customer sees "Standard Haircut, 10:00, with Sarah"
```

#### Staff Examples by Vertical

| Vertical | Staff Examples |
|----------|---------------|
| **Beauty** | Senior Barber, Junior Barber, Nail Technician, Massage Therapist |
| **Sport** | Personal Trainer, Tennis Coach, Yoga Instructor, Swimming Teacher |
| **Pet Care** | Senior Groomer, Veterinarian, Dog Trainer, Pet Sitter |

---

### 3.8 Authentication

#### Unified User Model

**Single login for all roles:**
- One User account for both customer and provider roles
- User registers once → can book services as customer
- Same user can "become a provider" → creates Provider extension record
- Same login, same profile, both capabilities

#### Supported Authentication Methods

| Method | Notes |
|--------|-------|
| Email + Password | Requires email verification |
| Google OAuth | No email verification needed |
| Facebook OAuth | No email verification needed |
| Paysera OAuth | No email verification needed |

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| AUTH-001 | User | register/login with Google | I can use my existing Google account | Must |
| AUTH-002 | User | register/login with Facebook | I can use my existing Facebook account | Must |
| AUTH-003 | User | register/login with Paysera | I can use my existing Paysera account | Must |
| AUTH-004 | User | register/login with email and password | I can create a standalone account | Must |
| AUTH-005 | User | reset my password | I can regain access if I forget it | Must |
| AUTH-006 | User | link multiple auth methods to my account | I can log in different ways | Should |
| AUTH-007 | User | stay logged in across sessions | I don't have to log in every time | Must |
| AUTH-008 | User | become a provider with my existing account | I can list my business without creating a new account | Must |

#### Acceptance Criteria: AUTH-001 (Google OAuth)

```gherkin
GIVEN I am on the login/register page
WHEN I click "Continue with Google"
THEN I am redirected to Google OAuth consent screen

GIVEN I authorize the application
WHEN Google redirects back
THEN my account is created (if new) or I am logged in (if existing)
AND my profile is pre-filled with Google name and email
AND no email verification is required

GIVEN I already have an account with the same email (different auth method)
WHEN I try to log in with Google
THEN I am prompted to link accounts or use existing login method
```

#### OAuth Provider Configuration

| Provider | Scopes Required | Profile Data |
|----------|-----------------|--------------|
| Google | `openid`, `email`, `profile` | Name, Email, Profile picture |
| Facebook | `email`, `public_profile` | Name, Email, Profile picture |
| Paysera | `email`, `profile` | Name, Email |

---

### 3.8 Payments

#### Payment Processing

**Paysera Checkout v3** — Backend payment gateway (not user-facing).

Customers pay via their preferred method (cards, Revolut, bank transfer, etc.) — Paysera processes the payment behind the scenes.

#### User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| PAY-001 | Customer | pay for my booking at checkout | the appointment is confirmed | Must |
| PAY-002 | Customer | see the total price before paying | I know what I'm paying | Must |
| PAY-003 | Customer | receive a payment receipt | I have proof of payment | Must |
| PAY-004 | Provider | receive payment for bookings | I get paid for my services | Must |
| PAY-005 | Provider | view my earnings and transactions | I can track my revenue | Must |
| PAY-006 | Provider | connect my Paysera account for payouts | I can receive funds | Should |
| PAY-007 | Customer | get a refund if I cancel in time | I'm not charged unfairly | Should |
| PAY-008 | Provider | set cancellation/refund policy | I control my refund rules | Should |

#### Acceptance Criteria: PAY-001 (Payment at Checkout)

```gherkin
GIVEN I have confirmed my booking details
WHEN I proceed to payment
THEN I am redirected to payment page (Paysera Checkout)
AND I see the service name, provider, and total amount
AND I can choose my payment method (card, Revolut, bank transfer, etc.)

GIVEN I complete payment via my chosen method
WHEN payment gateway redirects back with success
THEN my booking status changes to "Confirmed & Paid"
AND I receive a confirmation email with receipt
AND the provider receives a booking notification

GIVEN I cancel or payment fails
WHEN payment gateway redirects back with failure/cancel
THEN my booking is NOT confirmed
AND the time slot remains available
AND I see an error message with retry option
```

#### Payment Flow

```
1. Customer confirms booking
   └── Redirect to Paysera Checkout v3
       ├── Customer completes payment
       │   └── Paysera callback (success)
       │       └── Booking confirmed
       │       └── Email receipt sent
       │       └── Provider notified
       └── Customer cancels or payment fails
           └── Paysera callback (failure)
               └── Booking not created
               └── Slot released
```

#### Paysera Integration Details

**Paysera Checkout v3** is our payment processing infrastructure — customers are NOT tied to Paysera.

| Attribute | Value |
|-----------|-------|
| API Version | Checkout v3 |
| Role | Backend payment gateway (invisible to users) |
| Webhook events | `payment.completed`, `payment.failed`, `refund.completed` |
| Supported currencies | EUR (primary), others TBD |
| Payout schedule | Provider-configurable (daily, weekly, monthly) |
| Platform fee | TBD (% per transaction) |

#### Customer Payment Methods (via Paysera Checkout)

Paysera Checkout supports multiple payment providers — customers choose how to pay:

| Payment Method | Description |
|----------------|-------------|
| Credit/Debit Cards | Visa, Mastercard, etc. |
| Revolut | Direct Revolut payments |
| Bank Transfer | Various banks supported |
| Paysera Wallet | For users who have Paysera accounts |
| Other methods | Depending on region/configuration |

**Key point:** Users pay via their preferred method. Paysera Checkout handles the processing behind the scenes.

---

## 4. User Flows

### 4.1 Provider Onboarding Flow

```
1. Landing Page
   └── Click "List Your Business"
       └── Registration Form
           ├── Fill email, password, business name, category
           └── Submit
               └── Email Verification Sent
                   └── Click verification link
                       └── Email Verified
                           └── Profile Setup Wizard
                               ├── Step 1: Business details (description, photos)
                               ├── Step 2: Add first service
                               ├── Step 3: Set working hours
                               └── Complete
                                   └── Dashboard (profile live)
```

### 4.2 Customer Booking Flow

```
1. Homepage / Search
   └── Browse categories OR search
       └── Provider List
           └── Select provider
               └── Provider Profile
                   └── Select first service
                       └── Select date
                           └── [If Fixed] Select time slot
                           └── [If Flexible] Select start time + duration
                               └── Login/Register (if not logged in)
                                   └── Booking Summary
                                       ├── Equipment: auto-assigned by system
                                       ├── "Add another service" (optional)
                                       │   └── Select additional service
                                       │       └── Auto-scheduled after previous
                                       │           └── Return to Booking Summary
                                       └── Proceed to Payment (Paysera)
                                           └── Confirmation Page
                                               └── Email sent
                                               └── Booking in "My Bookings"
```

#### Multi-Service Booking Flow

```
1. Customer selects "Haircut" (fixed, 45 min, €35)
   └── Select date: March 30
       └── Select time: 10:00
           └── Booking Summary shows:
               ├── Haircut: 10:00-10:45, €35
               └── Total: €35
                   └── Click "Add another service"
                       └── Select "Manicure" (fixed, 60 min, €50)
                           └── Auto-scheduled: 10:45-11:45
                               └── Booking Summary shows:
                                   ├── Haircut: 10:00-10:45, €35
                                   ├── Manicure: 10:45-11:45, €50
                                   └── Total: €85
                                       └── Proceed to payment
```

#### Flexible Duration Flow

```
1. Customer selects "Tennis Court Rental" (flexible, €15/hour, 1-4h)
   └── Date picker → Select March 30
       └── Start time picker → Select 10:00
           └── Duration selector → Select 3 hours
               └── Booking Summary shows:
                   ├── Tennis Court Rental: 10:00-13:00
                   ├── Equipment: Tennis Court #1
                   └── Total: €45
                       └── Proceed to payment
```

### 4.3 Customer Registration Flow

```
1. Click "Sign Up" or prompted during booking
   └── Registration Form
       ├── Fill name, email, password, phone
       └── Submit
           └── Email Verification Sent
               └── Click verification link
                   └── Email Verified
                       └── Redirect to original page / My Bookings
```

### 4.4 Provider Daily Operations Flow

```
1. Login
   └── Dashboard
       ├── Today's appointments (list)
       ├── New booking notifications
       └── Quick actions:
           ├── View calendar (week/month view)
           ├── Block time
           ├── Add manual booking
           └── Manage services
```

---

## 5. Information Architecture

### 5.1 Provider Dashboard Structure

```
Provider Portal
├── Business Switcher (if multiple businesses)
│   └── Select: "John's Barbershop" / "John's Tennis Academy"
│
├── Location Switcher (if multiple locations)
│   └── Select: "Downtown" / "Mall" / "All Locations"
│
├── Dashboard (home)
│   ├── Today's appointments (for selected location)
│   ├── Upcoming (next 7 days)
│   └── Quick stats (earnings, bookings)
├── Calendar
│   ├── Day view
│   ├── Week view
│   └── Month view
├── Bookings
│   ├── Upcoming
│   ├── Past
│   └── Cancelled
├── Services (per location)
│   ├── Active services
│   └── Disabled services
├── Equipment (per location)
│   ├── Active equipment
│   ├── Disabled equipment
│   └── Equipment-service mapping
├── Staff (per location)
│   ├── Staff list
│   ├── Staff schedules
│   └── Staff-service mapping
├── Earnings
│   ├── Overview (balance, pending)
│   ├── Transactions
│   ├── Payouts
│   └── Paysera account setup (optional, for payouts)
├── Availability (per location)
│   ├── Location working hours
│   ├── Equipment hours
│   └── Blocked times
├── Business Settings
│   ├── Business profile (name, logo, description)
│   └── Locations management
│       ├── Add location
│       └── Edit location (address, contact, photos)
└── Account Settings
    ├── Notifications
    └── Account (linked auth methods)
```

### 5.2 Customer-Facing Structure

```
Public Site
├── Homepage
│   ├── Search bar
│   ├── Category browse (Beauty / Sport / Pet Care)
│   └── Featured businesses/locations
├── Search Results
│   ├── Filters (category, city, distance)
│   └── Location cards (showing business name + location)
├── Business/Location Profile
│   ├── Business name + Location name
│   ├── About
│   ├── Services list
│   ├── Staff (if applicable)
│   ├── Address/map
│   └── Book button
├── Auth
│   ├── Login
│   ├── Register
│   └── Forgot password
├── Booking Flow (requires login)
│   ├── Date picker
│   ├── Time picker (or duration for flexible)
│   └── Confirmation (equipment auto-assigned)
└── My Account (requires login)
    ├── My Bookings
    │   ├── Upcoming
    │   ├── Past
    │   └── Cancelled
    └── Profile settings
```

---

## 6. Data Requirements

### 6.1 Core Entities

#### Entity Relationship — Business Hierarchy

```
Provider (account owner)
└── Business (brand/company)
    └── Location (operational unit) ← Everything lives here
        ├── Services
        ├── Staff
        ├── Equipment
        └── Bookings
```

**Key principle:** Location is the operational unit. Services, Staff, Equipment, and Bookings all belong to a Location.

**Customer sees:** Businesses and their Locations (not Providers)

#### Entity Relationship — Booking

```
Booking (1) ──→ BookingItem (many) ──→ Service (1)
     │                │                    │
     │                ├── equipment_id     ├── ServiceEquipment ──→ Equipment
     │                └── staff_id         └── ServiceStaff ──→ Staff
     │
     └── location_id
```

#### User (unified)

| Entity | Key Attributes |
|--------|----------------|
| **User** | id, email, password_hash, name, phone, email_verified, created_at |
| **UserAuthMethod** | id, user_id, auth_provider (google/facebook/paysera/email), provider_user_id, created_at |

**Note:** Single User table for everyone. Same login works for booking (as customer) and managing business (as provider).

#### Provider Extension

| Entity | Key Attributes |
|--------|----------------|
| **Provider** | id, user_id (FK → User), created_at, status |

**Note:** Creating a Provider record "upgrades" a User to provider role. User without Provider record = customer only.

**Payment setup:** Paysera account linking handled separately (post-onboarding). Providers can onboard and set up their business without payment configuration.

#### Business & Location

| Entity | Key Attributes |
|--------|----------------|
| **Business** | id, provider_id, name, category, description, logo, cover_image, is_active, created_at |
| **Location** | id, business_id, name, address, city, country, phone, email, coordinates, timezone, is_active, created_at |

#### Staff (per Location)

| Entity | Key Attributes |
|--------|----------------|
| **Staff** | id, location_id, name, role, description, photo, is_active, created_at |
| **StaffAvailability** | id, staff_id, day_of_week, start_time, end_time, is_active |
| **ServiceStaff** | id, service_id, staff_id (which staff can perform this service) |

#### Equipment (per Location)

| Entity | Key Attributes |
|--------|----------------|
| **Equipment** | id, location_id, name, description, capacity, photo, is_active, created_at |
| **EquipmentAvailability** | id, equipment_id, day_of_week, start_time, end_time, is_active |
| **ServiceEquipment** | id, service_id, equipment_id (which equipment this service requires) |

#### Services (per Location)

| Entity | Key Attributes |
|--------|----------------|
| **Service** | id, location_id, name, description, duration_type (fixed/flexible), duration_minutes, time_unit_minutes, price, price_type (flat/per_unit), min_duration_minutes, max_duration_minutes, currency, category, requires_staff, requires_equipment, is_active, display_order |

#### Availability (per Location)

| Entity | Key Attributes |
|--------|----------------|
| **LocationAvailability** | id, location_id, day_of_week, start_time, end_time, is_active |
| **BlockedTime** | id, location_id, staff_id (nullable), equipment_id (nullable), start_datetime, end_datetime, reason |

#### Bookings (per Location)

| Entity | Key Attributes |
|--------|----------------|
| **Booking** | id, location_id, user_id (FK → User, the customer), status, total_amount, currency, notes, created_at |
| **BookingItem** | id, booking_id, service_id, equipment_id (nullable), staff_id (nullable), start_datetime, end_datetime, duration_minutes, price, status |

**Note:** No BookingItemEquipment table. Equipment/staff availability is checked by counting concurrent BookingItems.

#### Payments (MVP: Abstracted)

**MVP Approach:** Payments handled via `AbstractPaymentProvider` interface. No payment entities in database for now.

```
interface PaymentProvider {
  createPayment(booking, amount) → PaymentResult
  handleCallback(data) → PaymentStatus
  refund(paymentRef) → RefundResult
}

// MVP implementation
class MockPaymentProvider implements PaymentProvider {
  // Simulates payment success/failure for testing
}

// Future implementation
class PayseraCheckoutProvider implements PaymentProvider {
  // Real Paysera Checkout v3 integration
}
```

**Database entities (TBD):** Payment and Payout tables will be added when real payment provider is integrated.

#### Example: Multi-Service Booking

```
Booking #123
├── customer_id: 456
├── provider_id: 789
├── total_amount: €85
├── status: confirmed
│
├── BookingItem #1
│   ├── service: "Haircut" (45 min, €35)
│   ├── start: 10:00, end: 10:45
│   ├── staff: "Senior Barber John"
│   └── equipment: "Hair Station" (counted against capacity)
│
└── BookingItem #2
    ├── service: "Manicure" (60 min, €50)
    ├── start: 10:45, end: 11:45
    ├── staff: "Nail Tech Sarah"
    └── equipment: "Nail Table" (counted against capacity)
```

#### Example: Service with Staff Only (No Equipment)

```
Service: "Personal Training Session"
├── duration: 1 hour
├── price: €50
├── requires_staff: true
├── requires_equipment: false
│
└── ServiceStaff
    ├── "Trainer Mike"
    └── "Trainer Lisa"

Booking at 10:00:
├── service: "Personal Training Session"
├── staff_id: "Trainer Mike" (auto-assigned, available)
└── equipment_id: null
```

#### Example: Service with Equipment Only (Capacity-Based)

```
Equipment: "Tennis Court" (capacity: 3)

Service: "Tennis Court Rental"
├── duration_type: flexible (1-4 hours)
├── price: €15/hour
├── requires_staff: false
├── requires_equipment: true
│
└── ServiceEquipment
    └── "Tennis Court"

Availability check at 10:00:
├── Count BookingItems using "Tennis Court" at 10:00 = 2
├── Capacity = 3
└── Available? Yes (2 < 3)
```

#### Example: Service with Both Staff and Equipment

```
Service: "Tennis Lesson"
├── duration: 1 hour
├── price: €40
├── requires_staff: true
├── requires_equipment: true
│
├── ServiceStaff
│   └── "Coach Alex"
│
└── ServiceEquipment
    └── "Tennis Court" (capacity: 3)

Booking:
├── staff_id: "Coach Alex" (must be available)
└── equipment_id: "Tennis Court" (counted against capacity)
```

### 6.2 Booking Statuses

| Status | Description |
|--------|-------------|
| `pending_payment` | Booking created, awaiting payment |
| `confirmed` | Payment received, booking confirmed |
| `cancelled_by_customer` | Customer cancelled (may trigger refund) |
| `cancelled_by_provider` | Provider cancelled (triggers refund) |
| `completed` | Appointment has passed |
| `no_show` | Customer didn't show up |
| `refunded` | Payment was refunded |

### 6.3 Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Payment initiated, awaiting Paysera response |
| `completed` | Payment successful |
| `failed` | Payment failed |
| `refunded` | Payment refunded |
| `partially_refunded` | Partial refund issued |

---

## 7. UI/UX Requirements

### 7.1 Design Principles

1. **Mobile-first**: Majority of bookings happen on mobile
2. **Speed**: Booking should take < 60 seconds
3. **Clarity**: No ambiguity in available times or prices
4. **Trust**: Professional appearance builds provider credibility

### 7.2 Key Screens (MVP)

| Screen | Platform | Priority |
|--------|----------|----------|
| Landing page | Web | Must |
| Provider registration (with OAuth options) | Web | Must |
| Provider dashboard | Web | Must |
| Provider calendar | Web | Must |
| Service management | Web | Must |
| Equipment management | Web | Must |
| Staff management | Web | Must |
| Staff schedule settings | Web | Must |
| Availability settings | Web | Must |
| Provider earnings/transactions | Web | Must |
| Provider Paysera account setup | Web | Should (optional for onboarding) |
| Provider public profile | Web (responsive) | Must |
| Customer registration (with OAuth options) | Web (responsive) | Must |
| Customer login (with OAuth options) | Web (responsive) | Must |
| Customer "My Bookings" | Web (responsive) | Must |
| Booking flow | Web (responsive) | Must |
| Payment (Paysera redirect) | External | Must |
| Booking confirmation + receipt | Web (responsive) | Must |
| Search/browse | Web (responsive) | Must |

### 7.3 Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile | < 768px | Primary customer experience |
| Tablet | 768px - 1024px | Secondary |
| Desktop | > 1024px | Primary provider experience |

---

## 8. MVP Prioritization Matrix

| Feature | Impact | Effort | Priority | MVP? |
|---------|--------|--------|----------|------|
| Provider registration | High | Low | P0 | Yes |
| Customer registration & login | High | Medium | P0 | Yes |
| OAuth (Google, Facebook, Paysera) | High | Medium | P0 | Yes |
| Service management (fixed duration) | High | Low | P0 | Yes |
| Service management (flexible duration) | High | Medium | P0 | Yes |
| Equipment management (capacity-based) | High | Medium | P0 | Yes |
| Staff management | High | Medium | P0 | Yes |
| Working hours (provider + staff) | High | Medium | P0 | Yes |
| Customer booking flow (fixed) | High | Medium | P0 | Yes |
| Customer booking flow (flexible + duration picker) | High | Medium | P0 | Yes |
| Payments (abstracted/mock) | High | Low | P0 | Yes |
| Email notifications | High | Low | P0 | Yes |
| Provider calendar view | High | Medium | P0 | Yes |
| Search/browse | Medium | Medium | P1 | Yes |
| Block time | Medium | Low | P1 | Yes |
| Equipment availability hours | Medium | Medium | P1 | Yes |
| Provider payouts | Medium | Medium | P1 | Yes |
| Refunds | Medium | Medium | P1 | Yes |
| SMS notifications | Medium | Medium | P2 | No |
| Mobile apps | Medium | High | P3 | No |

---

## 9. Success Metrics (Product)

| Metric | Definition | Target | Measurement |
|--------|------------|--------|-------------|
| Provider activation rate | % of registered providers who add 1+ service | > 70% | Analytics |
| Time to first booking | Days from provider signup to first booking received | < 14 days | Analytics |
| Booking completion rate | % of started bookings that complete | > 80% | Analytics |
| Provider retention (30d) | % of providers active after 30 days | > 60% | Analytics |
| Customer return rate | % of customers who book again within 60 days | > 30% | Analytics |

---

## 10. Open Questions

| # | Question | Owner | Due Date | Status |
|---|----------|-------|----------|--------|
| 1 | What is the target country for launch? | Stakeholder | TBD | Open |
| 2 | Should providers require approval before going live? | Product | TBD | Open |
| 3 | What currency/currencies to support? | Product | TBD | Open |
| 4 | Should customers be able to leave reviews? (MVP or later) | Product | TBD | Open |
| 5 | Cancellation policy — how far in advance? Provider-configurable? | Product | TBD | Open |

---

## 11. BRD Traceability

| BRD Requirement | PRD Coverage | Status |
|-----------------|--------------|--------|
| Provider registration & profile | Section 3.1 (P-001 to P-008) | Covered |
| Service & schedule management | Section 3.2, 3.3 (S-001 to S-007, A-001 to A-007) | Covered |
| Equipment management | Section 3.6 (E-001 to E-008) | Covered |
| Customer registration & accounts | Section 3.4 (B-005 to B-006, B-009, B-012) | Covered |
| Authentication (Google, Facebook, Paysera, Email) | Section 3.7 (AUTH-001 to AUTH-007) | Covered |
| Customer booking flow | Section 3.4 (B-001 to B-012) | Covered |
| Payments (Paysera Checkout v3) | Section 3.8 (PAY-001 to PAY-008) | Covered |
| Notifications/reminders | Section 3.5 (N-001 to N-006) | Covered |
| SMS notifications | Deferred to Post-MVP | Documented |
| Mobile apps | Deferred to Post-MVP | Documented |
| Multi-location support | Deferred to Post-MVP | Documented |
| Team/staff management | Deferred to Post-MVP | Documented |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Provider | Account owner who can manage multiple businesses |
| Business | A brand/company owned by a provider (e.g., "John's Barbershop") |
| Location | An operational unit within a business with its own address, staff, equipment, and services |
| User | A registered account (can be customer, provider, or both with same login) |
| Customer | A user who books services |
| Service | A specific offering with name, duration, and price |
| Fixed Duration | Provider-configured service with predetermined length — flat price (any vertical) |
| Flexible Duration | Provider-configured service where customer chooses length within min/max — price per time unit (any vertical) |
| Equipment | A physical resource required for a service (e.g., tennis court, nail table, grooming station) |
| Capacity | The number of simultaneous bookings an equipment can handle (counted, not tracked by unit) |
| Staff | Personnel who provide services (barbers, trainers, groomers) — individual people |
| Booking | A confirmed appointment containing one or more services with a single payment |
| BookingItem | A single service within a booking, with its own time slot and equipment |
| Slot | An available time window for booking |
| Working Hours | Provider's regular business hours |
| Blocked Time | Time marked as unavailable by provider or for specific equipment |
| OAuth | Authentication via third-party provider (Google, Facebook, Paysera) |
| Paysera Checkout | Payment gateway (future implementation; MVP uses mock provider) |
| Payout | Transfer of earnings from Bookit to provider's Paysera account |
| Platform Fee | Percentage taken by Bookit from each transaction |
| AI Agent | External AI assistant that interacts with Bookit via API |

---

## Appendix B: Future Considerations — AI Agent Integration

> **Status**: Post-MVP. Document for architectural awareness during MVP implementation.

### Overview

Bookit will support interaction via AI agents/assistants, enabling customers and providers to manage bookings through conversational interfaces (chatbots, voice assistants, third-party AI tools).

### Anticipated Use Cases

| Actor | Use Case | Example |
|-------|----------|---------|
| Customer | Book via AI assistant | "Book me a haircut at Salon X tomorrow at 3pm" |
| Customer | Check/manage bookings | "What appointments do I have this week?" |
| Customer | Cancel/reschedule | "Move my tennis court booking to Friday" |
| Provider | Check schedule | "What's my calendar for today?" |
| Provider | Block time | "Block my calendar next Monday" |
| Provider | Get insights | "How many bookings did I have last week?" |

### Architectural Implications (MVP Considerations)

To enable future AI integration, MVP implementation should:

1. **API-first design** — All functionality accessible via well-documented REST/GraphQL API
2. **Clear action semantics** — Operations should be atomic and have predictable outcomes
3. **Structured responses** — API responses should be machine-readable (consistent JSON schema)
4. **Idempotency** — Support idempotent operations for safe retries
5. **Authentication tokens** — Support API keys / OAuth tokens for agent authentication
6. **Rate limiting** — Plan for automated traffic patterns

### Potential Integration Points

| Integration | Description |
|-------------|-------------|
| MCP (Model Context Protocol) | Expose Bookit tools for Claude and other AI assistants |
| OpenAI Function Calling | Compatible API structure for GPT-based agents |
| Voice Assistants | Alexa, Google Assistant, Siri integrations |
| Chat Platforms | Telegram bots, WhatsApp Business API |

### Not in Scope for MVP

- AI agent SDK or official integrations
- Conversational UI within Bookit
- AI-powered recommendations or scheduling optimization

---

*Generated from BRD-Bookit-20260327.md*
