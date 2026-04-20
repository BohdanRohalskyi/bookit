# RBAC — Manual Test Scenarios

> Requires `docker compose up` running locally.

---

## Space Picker

**Happy path — single business owner**
1. Log in with an existing provider account
2. Should redirect to `/dashboard` and auto-select your business — `/spaces` is never shown (SpaceGuard skips it when only 1 workspace exists)

**Happy path — multiple spaces**
1. Create a second business, then log out and back in
2. `/spaces` should show two cards, each with business name, category, and "Owner" badge
3. Click one → lands on `/dashboard` with that business name shown in the sidebar workspace indicator
4. Click the workspace indicator (chevron) → clears space, returns to `/spaces`

**Logout clears space**
- Log out → the space store should be cleared
- Next login starts fresh at `/spaces`

---

## Role-aware navigation

**As Owner** — all nav items visible: Dashboard, Manage Businesses, Add Business, Locations, Team, plus Coming Soon overlays for Bookings, Calendar, Reports, Payment, Settings

**As Administrator** (after being assigned that role — see staff invite flow below) — Manage Businesses and Add Business are hidden; Team, Locations, Dashboard remain

**As Staff** — only Dashboard, Locations, and Bookings (Coming Soon) visible; Team is hidden

---

## Staff Management — invite a new user

1. Log in as owner → pick workspace → go to **Team** in the nav
2. Click **Invite member**
3. Enter an email that doesn't exist in the system yet, select role **Administrator**, click **Send invite**
4. Check Mailpit (`http://localhost:8025`) — invite email should arrive with a link to `http://localhost:5174/invites?token=...`
5. Open the invite link in a new tab → shows "You've been invited to join [Business] as Administrator"
6. Register a new account with that email → after registration, click **Accept Invitation**
7. The role assignment is created; log in with the new account and verify Administrator nav

---

## Staff Management — invite an existing user

1. On the **Team** page, invite an email that IS already registered
2. No invite link email — instead, a "you've been added" notification email arrives in Mailpit
3. The new member appears immediately in the **Active members** list (not pending)

---

## Staff Management — pending invite

1. Invite a non-existent email
2. Before the person accepts, go back to **Team** — the invite appears in **Pending invites** with the email, role, and a "Pending" badge
3. Click the trash icon → invite is cancelled and disappears from the list

---

## Staff Management — remove an active member

1. After someone has accepted and appears in **Active members**, click the trash icon on their row
2. They're removed from the list immediately

---

## Invite accept — not logged in

1. Open an invite link without being logged in
2. Should show the invite card with **"Log in to accept"** button
3. Clicking it redirects to `/login?redirect=...`

---

## Edge cases

- Navigating directly to `/dashboard` without a space selected → 0 workspaces redirects to `/dashboard/businesses/new`; 2+ workspaces redirects to `/spaces`
- Invite link already used → should show "This invite has already been accepted" (410 Gone)
- Invite link with a bad/expired token → should show "Invite not found or has expired" (404)
- The sidebar user row shows the current role (e.g. "Administrator") instead of the email for non-owners
