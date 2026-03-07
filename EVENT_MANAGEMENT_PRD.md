# SGT University — Event Management System
# Product Requirements Document (PRD) — For QA/Testing

**Version:** 2.0  
**Date:** March 6, 2026  
**Product:** SGT UMS — Event Management Module  
**Purpose:** Detailed PRD for QA testers to understand features, flows, edge cases, and expected behavior.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Module 1 — Event Discovery & Listing](#3-module-1--event-discovery--listing)
4. [Module 2 — Event Detail Page](#4-module-2--event-detail-page)
5. [Module 3 — Event Registration (Individual)](#5-module-3--event-registration-individual)
6. [Module 4 — Team Registration & Management](#6-module-4--team-registration--management)
7. [Module 5 — Payment Integration (Razorpay)](#7-module-5--payment-integration-razorpay)
8. [Module 6 — Coupon & Discount System](#8-module-6--coupon--discount-system)
9. [Module 7 — QR Code Attendance Scanning](#9-module-7--qr-code-attendance-scanning)
10. [Module 8 — Event Management Dashboard](#10-module-8--event-management-dashboard)
11. [Module 9 — Registration Management](#11-module-9--registration-management)
12. [Module 10 — Volunteer Management](#12-module-10--volunteer-management)
13. [Module 11 — Certificate System](#13-module-11--certificate-system)
14. [Module 12 — Bulk Email System](#14-module-12--bulk-email-system)
15. [Module 13 — Stall Management](#15-module-13--stall-management)
16. [Module 14 — Feedback System](#16-module-14--feedback-system)
17. [Module 15 — Prize Management](#17-module-15--prize-management)
18. [Module 16 — Event Settings & Visibility](#18-module-16--event-settings--visibility)
19. [Module 17 — Custom Registration Fields](#19-module-17--custom-registration-fields)
20. [Module 18 — My Registrations / Tickets](#20-module-18--my-registrations--tickets)
21. [Module 19 — My Certificates](#21-module-19--my-certificates)
22. [Module 20 — Certificate Verification (Public)](#22-module-20--certificate-verification-public)
23. [Module 21 — Stall Opportunities (Student View)](#23-module-21--stall-opportunities-student-view)
24. [Module 22 — Event Analytics](#24-module-22--event-analytics)
25. [Database Enums Reference](#25-database-enums-reference)
26. [API Endpoints Summary](#26-api-endpoints-summary)
27. [Test Scenarios & Edge Cases](#27-test-scenarios--edge-cases)

---

## 1. System Overview

The Event Management System is a module within SGT University Management System (UMS) that handles the full lifecycle of university events — from creation through a noting/approval workflow, to student registration, attendance tracking, certificate distribution, and post-event feedback/analytics.

### High-Level Flow

```
Faculty files Noting Request → DSW Office Approves → Draft Event Created
    → Creator Configures (settings, fields, templates, visibility)
    → Event Published → Students Discover & Register
    → QR Code Generated → Entry/Exit Scanning at Venue
    → Post-Event: Certificates, Bulk Emails, Feedback, Analytics
```

### Tech Stack (for tester context)
- **Frontend:** Next.js (React), Tailwind CSS, TypeScript
- **Backend:** Node.js, Express.js, Prisma ORM
- **Database:** PostgreSQL (via Prisma)
- **Payments:** Razorpay (orders + webhook verification)
- **Email:** SendGrid (with open tracking pixel)
- **Certificates:** Puppeteer (headless Chrome → PDF) + S3 storage
- **Storage:** AWS S3 (certificate PDFs, template images, uploads)
- **QR Codes:** Generated per registration, stored in DB

---

## 2. User Roles & Permissions

### Roles

| Role | Description | Key Capabilities |
|------|-------------|-----------------|
| **Student** | University student | Register for events, form/join teams, view tickets, submit feedback, view certificates |
| **Faculty** | Teaching staff | Create events (via noting), manage own events, assign volunteers, view reports |
| **Staff** | Administrative staff | Create events, manage own events |
| **Admin / Superadmin** | System administrators | Manage ALL events, view all data, override visibility, toggle events |
| **Volunteer** | Assigned by event creator | Scan QR codes (if permitted), view own scan history |
| **Club Chairperson** | Student club leader | Auto-granted event management for club events |

### Permission Matrix

| Permission | Description | Who Has It |
|------------|-------------|-----------|
| `event_create` | Create new events (needs approved noting) | Faculty (default), Staff (default) |
| `event_manage_own` | Edit/manage events the user created | Event creators |
| `event_manage_all` | Edit/manage ANY event | Admin, Superadmin, DSW Office |
| `event_publish` | Publish events (make visible to students) | Event creators, Admin |
| `event_cancel` | Cancel scheduled events | Event creators, Admin |
| `event_view_all` | View all events including unpublished | Admin |
| `event_manage_attendance` | Mark attendance, manage check-ins | Event creators, assigned volunteers |
| `event_assign_volunteers` | Assign volunteers to events | Event creators, Admin |
| `event_view_reports` | View analytics and attendance reports | Event creators, Admin |

### Access Rules to Test

- Students **cannot** access any `/management` pages for events they didn't create.
- The `?myEvents=true` filter only works for faculty, staff, admin, superadmin, and club chairpersons.
- Volunteers can **only** scan QR codes if `canScanQr = true` on their volunteer record.
- Event visibility is enforced — student must be in allowed role + school/department/program/batch to see the event.

---

## 3. Module 1 — Event Discovery & Listing

### Page: `/events`

### UI Components
- **Search bar** with 300ms debounce — searches event names
- **Filter panel** toggle button
- **Festival grouping** — events with the same `festivalNotingId` are grouped together with expand/collapse
- **Expand All / Collapse All** buttons for festival groups
- **Event cards** — each card shows event name, dates, venue, type badge, capacity progress bar, status badge
- **Pagination** — 20 events per page, Previous/Next buttons
- **Info banner** — links to "Noting Requests" and "My Created Events"

### Expected Behavior

| Action | Expected Result |
|--------|----------------|
| Page loads | Fetch events the user is allowed to see (visibility-filtered), ordered by startDate desc |
| Type in search bar | After 300ms, list filters to matching event names (case-insensitive) |
| Click event card | Navigate to `/events/[eventId]` |
| Hover over event card | Next.js prefetches event data for instant navigation |
| Click "Expand All" | All festival groups expand |
| Click "Collapse All" | All festival groups collapse |
| Scroll to bottom | Pagination shows if total > 20 events |

### What to Test
1. Visibility filter — student in Department A should NOT see event restricted to Department B
2. Events with `status = draft` should NOT appear for students
3. Festival grouping correctness — sub-events under same festival should group
4. Search works across event names
5. Pagination: verify page 2 loads next 20, no duplicates
6. Empty state shows when no events match filters
7. Event card data matches actual event data (dates, capacity, venue)

---

## 4. Module 2 — Event Detail Page

### Page: `/events/[id]`

### Sections
1. **Header** — Event name, type badge (seminar/workshop/fest/etc.), status badge (draft/published/ongoing/completed/cancelled), mode icon (online/offline/hybrid)
2. **About card** — Event description (short + long)
3. **Dates & Times card** — Start date, end date, with "upcoming" / "ongoing" indicators
4. **Registration Status card** — Current registrations / max capacity, capacity progress bar, waitlist status
5. **Prize Pool section** (if `prizesEnabled = true`) — Lists prizes with position, rank, type, amount
6. **FAQ section** — Collapsible accordion for Q&A items
7. **Event Sidebar** — Creator details, social media links, contact info
8. **Register button** (CTA) — Routes to registration form
9. **Sponsorship section** (if `showSponsorshipPublicly = true`) — Sponsor names, amounts, types

### Expected Behavior

| Action | Expected Result |
|--------|----------------|
| Page load | Fetch event details + check if user has access |
| User not allowed (visibility) | Show "Event not found" or redirect |
| Click "Register" | Navigate to `/events/[id]/registration` |
| Event at capacity | Show "Registration Full" or "Waitlist" button |
| Registration closed (date passed) | Register button disabled/hidden |
| Event status = cancelled | Show cancellation banner, info only |
| Event status = completed | Show past event, no register option |
| FAQ click | Toggle accordion open/close |

### What to Test
1. All fields display correctly (name, description, dates, venue, capacity, fee)
2. Mode indicator (Online 🌐 / Offline 📍 / Hybrid 🔄) matches event data
3. Capacity progress bar accuracy (registrations/maxCapacity %)
4. "Upcoming" vs "Ongoing" date label logic
5. FAQ accordion: only one open at a time or multiple allowed?
6. Register button visibility based on registration dates, capacity, and event status
7. Prize section only visible when `prizesEnabled = true`
8. Sponsor section only visible when `showSponsorshipPublicly = true`

---

## 5. Module 3 — Event Registration (Individual)

### Page: `/events/[id]/registration`

### Form Components
- **Auto-filled fields** — firstName, lastName, email, phone, institute (from user profile)
- **Academic fields** — registrationNo, employeeId, gender, school, department, program, passOutYear (auto-detected from profile)
- **Custom fields** — dynamically rendered based on event's custom field configuration:
  - `text` — single-line input
  - `textarea` — multi-line input
  - `number` — numeric input
  - `email` — email-validated input
  - `phone` — phone number input
  - `url` — URL input
  - `date` — date picker
  - `time` — time picker
  - `datetime` — datetime picker
  - `dropdown` — select from options
  - `radio` — single choice from options
  - `checkbox` — multiple choice from options
  - `file` — file upload
  - `image` — image upload
- **Coupon section** — code input + "Apply" button + discount preview + "Remove" button
- **Fee display** — Original fee, discount (if coupon), final amount
- **Submit button** — with loading spinner

### Registration Flow

```
User lands on form
  → Profile fields auto-filled (name, email, etc.)
  → User fills custom fields
  → (Optional) Enters coupon code → clicks "Apply"
    → Backend validates: code valid, not expired, usage limit not reached, min amount met
    → Shows discount preview: "₹X off" or "X% off (max ₹Y)"
  → Clicks "Register"
    → IF free event: Registration created with status = confirmed (if autoApprove) or pending
    → IF paid event: Routes to payment page
    → IF team event: Routes to team registration page
```

### Business Rules

| Rule | Detail |
|------|--------|
| Duplicate registration | User cannot register for the same event twice (`@@unique([eventId, userId])`) |
| Registration cap | If `registrationCap` is set and reached, registration blocked or waitlisted |
| Registration period | Only allowed between `registrationStartDate` and `registrationEndDate` |
| Auto-approve | If `autoApproveRegistration = true`, status is `confirmed` immediately. Otherwise `pending`. |
| Form required | If `requireFormSubmission = true`, form must be filled before registration completes |
| QR code | A unique QR code is generated per registration upon creation |
| Inter-college allowed | If `interCollegeAllowed = false`, only SGT students can register |
| Custom field validation | Required fields must be filled, file size limits apply, email format validated |

### What to Test
1. **Profile auto-fill** — all pre-fillable fields populate from user data
2. **Required custom fields** — cannot submit if empty (inline error messages)
3. **File upload** — accepts correct MIME types, rejects invalid, respects size limits
4. **Dropdown/radio/checkbox** — options render correctly, selection works
5. **Coupon code flow:**
   - Valid coupon → shows discount amount, updates total
   - Invalid/expired coupon → shows error
   - Apply same coupon twice → should handle gracefully
   - Remove coupon → fee reverts to original
   - Coupon with max uses → reject after limit
   - Coupon with min amount → reject if fee below min
6. **Duplicate registration** — attempting to register again shows "Already registered" message
7. **Registration cap reached** — appropriate message/waitlist behavior
8. **Registration period expired** — form disabled or error shown
9. **Paid event** — redirects to payment page, not directly confirmed
10. **Team event** — redirects to team page after form

---

## 6. Module 4 — Team Registration & Management

### Page: `/events/[id]/registration/team`

### Tab: "Create Team"

| Feature | Detail |
|---------|--------|
| Team name input | User enters team name (unique per event) |
| User search | Search users by name/UID/email to invite |
| Send invitation | Click "Invite" on search result → creates `EventTeamInvitation` with status `pending` |
| Sent invitations list | Shows all pending invitations with cancel option |
| Join requests | Shows incoming join requests with accept/decline buttons |
| Member list | Shows confirmed members with: avatar, name, email, phone, status badge (Leader/Verified/Pending) |
| Remove member | Team leader can remove any member (except self) |
| Team size validation | `minTeamSize` and `maxTeamSize` enforced |
| Finalize button | Locks team → creates registrations for all members |

### Tab: "Join Team"

| Feature | Detail |
|---------|--------|
| Teams looking for members | Lists teams with `lookingForMembers = true` |
| Request to join | Click on team → sends `EventTeamRequest` with optional message |
| My invitations | Shows invitations received, with accept/decline buttons |
| Looking for teammates toggle | User can mark themselves as "Looking for teammates" |

### Team Lifecycle

```
Leader creates team → status = "forming"
  → Invites members / accepts join requests
  → Members join (status = "confirmed" on team member)
  → Team reaches minTeamSize → isComplete = true, status = "complete"
  → Leader clicks "Finalize" → 
    → Team locked (isLocked = true, status = "confirmed")
    → EventRegistration created for each member
    → QR codes generated per member
    → IF paid event → routes to team payment
```

### Business Rules

| Rule | Detail |
|------|--------|
| Team name uniqueness | `@@unique([eventId, name])` — same event cannot have two teams with same name |
| Min team size | Cannot finalize until team has at least `minTeamSize` members |
| Max team size | Cannot invite more than `maxTeamSize` members |
| Duplicate membership | User cannot join two teams for same event |
| Invitation expiry | Invitations can expire (optional `expiresAt`) |
| Lock after deadline | If `lockTeamAfterDeadline = true`, teams lock after `teamRegistrationDeadline` |
| Cross-institute teams | Only allowed if `allowCrossInstituteTeams = true` |
| Auto-approve teams | If `autoApproveTeams = true`, team registration auto-confirmed |
| Team editing | If `allowTeamEditAfterSubmission = false`, team is frozen after finalization |

### What to Test
1. **Create team** — name validation, unique name per event, creation succeeds
2. **Search users** — finds users by name/email/UID, shows relevant results
3. **Send invitation** — creates pending invitation, appears in invitee's list
4. **Accept invitation** — member added to team, member count updates
5. **Decline invitation** — invitation status changes, team unaffected
6. **Request to join** — creates pending request, appears in leader's list
7. **Accept join request** — member added, request status changes
8. **Reject join request** — request status changes, user not added
9. **Remove member** — member removed, team member count decreases
10. **Min team size** — finalize blocked if below min members
11. **Max team size** — invite blocked if at max members
12. **Finalize** — all members get registrations + QR codes, team locks
13. **Payment redirect** — after finalization on paid event, redirect to payment
14. **Duplicate team join** — user already on a team cannot create/join another
15. **Looking for teammates** — toggle visibility, appears in public listings
16. **Lock after deadline** — team operations blocked after deadline

---

## 7. Module 5 — Payment Integration (Razorpay)

### Individual Payment Flow

```
Registration created (paid event) → Payment page loads
  → Frontend calls POST /:id/payments/individual/create-order
    → Backend creates Razorpay order (amount, currency INR)
    → Returns orderId, amount, razorpayKey
  → Frontend opens Razorpay checkout modal
  → User completes payment
  → Razorpay returns: payment_id, order_id, signature
  → Frontend calls POST /:id/payments/individual/verify
    → Backend verifies Razorpay signature (HMAC-SHA256)
    → Updates registration: paymentStatus = "completed", status = "confirmed"
    → Creates Payment record
  → Success screen shown
```

### Team Payment Flow

```
Team finalized → Payment page loads
  → POST /:id/teams/:teamId/payments/create-order
    → Calculates: teamRegistrationFee × memberCount (after coupon if applicable)
    → Creates Razorpay order
  → Razorpay checkout → payment → verify
  → All team member registrations updated: paymentStatus = "completed"
```

### Webhook Flow

```
Razorpay sends webhook → POST /events/payments/webhook
  → Verify signature against webhook secret
  → Process payment.authorized / payment.captured / payment.failed events
  → Update registration + payment records
```

### Business Rules

| Rule | Detail |
|------|--------|
| Signature verification | Payment verify MUST match Razorpay HMAC-SHA256 signature |
| Idempotency | Double verification requests should not create duplicate records |
| Payment status | `pending` → `completed` (success) or `failed` (failure) |
| Refund support | `refunded` status exists for refund processing |
| Free events | No payment flow — registration confirmed immediately |
| Webhook fallback | Even if frontend verify fails, webhook ensures payment processed |

### What to Test
1. **Free event** — no payment flow, immediately confirmed
2. **Paid event** — Razorpay modal opens, payment succeeds → confirmed
3. **Payment failure** — Razorpay modal error → registration stays pending
4. **Invalid signature** — verify endpoint rejects with 400
5. **Webhook processing** — payment captured via webhook updates registration
6. **Coupon + payment** — correct amount after discount (originalAmount - discountAmount)
7. **Team payment** — amount = teamFee × memberCount, all members updated on success
8. **Refresh after payment** — payment status persists (not re-triggered)
9. **Concurrent payments** — two users paying simultaneously (no race conditions)

---

## 8. Module 6 — Coupon & Discount System

### Admin/Creator Endpoints
- **Create coupon** — `POST /:id/coupons`
- **List coupons** — `GET /:id/coupons`
- **Update coupon** — `PATCH /:id/coupons/:couponId`
- **Delete coupon** — `DELETE /:id/coupons/:couponId`
- **Validate coupon** — `POST /:id/coupons/validate` (available to registering user)

### Coupon Fields

| Field | Type | Description |
|-------|------|-------------|
| `code` | String (max 64) | Coupon code (unique per event) |
| `discountType` | Enum | `percentage` or `fixed` |
| `discountValue` | Float | % value or ₹ fixed amount |
| `maxDiscountCap` | Float? | Max ₹ discount for percentage coupons |
| `minAmount` | Float? | Minimum registration fee to apply coupon |
| `maxUses` | Int? | Total uses allowed (null = unlimited) |
| `maxUsesPerUser` | Int? (default 1) | Uses per user (null = unlimited) |
| `usedCount` | Int | Atomic counter of total uses |
| `expiresAt` | DateTime? | Expiry date (null = never expires) |
| `isActive` | Boolean | Soft toggle |

### Validation Rules (on coupon apply)

| Rule | Error |
|------|-------|
| Code not found | "Invalid coupon code" |
| Coupon inactive | "This coupon is no longer active" |
| Coupon expired | "This coupon has expired" |
| Max uses reached | "This coupon has reached its maximum usage limit" |
| Per-user limit reached | "You have already used this coupon" |
| Below min amount | "Minimum order amount of ₹X required" |

### Discount Calculation
- **Percentage:** `discount = registrationFee × (discountValue / 100)`, capped at `maxDiscountCap`
- **Fixed:** `discount = discountValue` (not exceeding registration fee)

### What to Test
1. **Create coupon** — all field validations, unique code per event
2. **Percentage discount** — correct calculation, cap applied
3. **Fixed discount** — correct deduction, not exceeding fee
4. **Max uses** — coupon rejected after limit
5. **Per-user limit** — same user cannot use same coupon twice
6. **Expiry** — coupon rejected after expiry date
7. **Min amount** — coupon rejected if fee below min
8. **Inactive coupon** — coupon rejected when `isActive = false`
9. **Apply + remove** — fee updates correctly both ways
10. **Concurrent coupon usage** — two users applying last use simultaneously (race condition)
11. **Delete coupon** — existing registrations using deleted coupon unaffected

---

## 9. Module 7 — QR Code Attendance Scanning

### Page: `/events/[id]/scan`

### UI Components
- **Entry/Exit toggle** — two buttons to select mode
- **QR code input** — text field (auto-focused, monospace) for scanning/pasting
- **Gate location** — optional text input (e.g., "Main Entrance")
- **Remarks** — optional textarea (2 rows)
- **Scan button** — submits the scan
- **Recent scans** — last 10 scans showing name, status (✓/✗), timestamp, error message

### Scan Flow

```
Volunteer opens scanner page → selects Entry or Exit
  → Scans QR code (value pasted/typed into input)
  → Clicks "Scan" or presses Enter
  → Backend POST /:id/scan:
    → Looks up registration by QR code
    → Validates: registration exists, belongs to this event, status is confirmed
    → Entry mode: checks user hasn't already entered without exiting
    → Exit mode: checks user has entered
    → Creates EventEntry record (entry/exit type, timestamp, gate, remarks)
    → Updates registration: hasEntered = true, enteredAt = now()
  → Result shown in recent scans list
  → Input cleared, auto-focused for next scan
```

### Business Rules

| Rule | Detail |
|------|--------|
| Valid QR only | QR must match an existing registration for this event |
| Registration confirmed | Only `confirmed` registrations can be scanned |
| Double entry prevention | Cannot scan "entry" if user already entered without exit |
| Exit without entry | Cannot scan "exit" if user hasn't entered |
| Gate tracking | Gate location stored per scan |
| Volunteer auth | Only users with `event_manage_attendance` permission OR volunteers with `canScanQr = true` |

### What to Test
1. **Valid entry scan** — success, EventEntry created, registration updated
2. **Valid exit scan** — success, EventEntry created
3. **Invalid QR code** — error shown, no record created
4. **QR from different event** — error: "Registration not found for this event"
5. **Cancelled registration scan** — error: "Registration is cancelled"
6. **Double entry** — error: "Already entered" (must exit first)
7. **Exit without entry** — error: "No entry record found"
8. **Gate location recorded** — stored in EventEntry
9. **Remarks recorded** — stored in EventEntry
10. **Recent scans list** — updates after each scan (success + failures)
11. **Volunteer without canScanQr** — 403 Forbidden
12. **Non-volunteer user** — 403 Forbidden (unless has attendance permission)
13. **Input auto-clears** after scan for continuous scanning
14. **Keyboard Enter** — triggers scan same as button click

---

## 10. Module 8 — Event Management Dashboard

### Page: `/events/[id]/management`

### Access Control
Only users with `event_manage_own` (for their events) or `event_manage_all` (for any event) can access.

### Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| **Overview** | OverviewTab | Event editing, settings, high-level metrics |
| **Registrations** | RegistrationsTab | Manage registrations, filters, export, email, certificates |
| **Volunteers** | VolunteersTab | Assign/remove volunteers, view scan activity |
| **Analytics** | AnalyticsTab | Charts, trends, attendance stats |
| **Stalls** | StallsTab | Manage stalls and applications |
| **Feedback** | FeedbackTab | View event + stall feedback results |
| **Coupons** | (via coupon management) | Create/manage coupons |
| **Settings** | (via settings) | Visibility, access controls, toggle ON/OFF |

### Dashboard Metrics
- **Attendance Rate %** — (entered / confirmed registrations) × 100
- **Confirmation Rate %** — (confirmed / total registrations) × 100
- **Capacity Usage %** — (total registrations / maxCapacity) × 100
- **Registration Status Breakdown** — Confirmed / Pending / Cancelled / Waitlisted counts
- **Daily Registration Trend** — cumulative chart
- **Revenue** — total amount collected (paid events)

### What to Test
1. **Tab persistence** — selected tab persists via URL (`?tab=registrations`)
2. **Refresh button** — refetches all data
3. **Permission check** — student without management permission gets 403
4. **All tabs load** without errors
5. **Metrics accuracy** — cross-verify with actual registration data

---

## 11. Module 9 — Registration Management

### Tab: Registrations (inside Management Dashboard)

### UI Components
- **Search** — search by name, email, UID
- **Status filter** — confirmed, pending, cancelled, waitlisted (pills)
- **Advanced filters** — school, department, program, passOutYear, role, gender
- **Table view** — sortable columns: name, UID, email, role, status, payment, team, entry
- **Teams view** — grouped by team with member lists
- **Checkbox selection** — individual or "select all"
- **Export CSV button** — downloads all registrations
- **Send Email button** — opens Bulk Email Slider
- **Send Certificates button** — opens Certificate Slider
- **Registration detail modal** — click row to expand

### Registration Detail Modal Contents
- Full user profile (name, UID, email, phone, gender)
- Academic details (school, department, program, batch year)
- Registration status + timestamp
- Payment details (status, amount, Razorpay transaction ID, coupon info)
- Team info (team name, team ID, leader flag)
- Entry/exit logs (timestamp, gate, volunteer who scanned)
- Form field responses (custom field values)

### Export CSV Columns
- Registration ID, Name, UID, Email, Role, Gender
- School, Department, Program, Pass-out Year
- Status, Payment Status, Amount Paid, Coupon Code, Discount
- Team ID, Team Name, Is Team Leader
- Has Entered, Entry Time, Exit Time
- Registration Date

### What to Test
1. **Search** — finds by name, email, UID (partial match)
2. **Status filter** — correct counts, correct rows
3. **Advanced filters** — each filter works independently and combined
4. **Table sorting** — by name, date, status
5. **Select all** — selects all visible rows
6. **Export CSV** — downloads correct data, all columns present
7. **Email slider** — opens with selected registration IDs if selection made
8. **Certificate slider** — opens with selected registration IDs if selection made
9. **Registration detail** — all fields populated correctly
10. **Payment info** — transaction ID, amount, coupon breakdown accurate
11. **Entry/exit logs** — chronological, correct timestamps
12. **Pagination** — 20 per page, correct totals
13. **Empty state** — no registrations message
14. **Filter options API** — returns distinct values from actual registrations (not all possible values)

---

## 12. Module 10 — Volunteer Management

### Tab: Volunteers (inside Management Dashboard)

### Features
- **Assign volunteer** — search from club members or all users
- **Volunteer list** — name, email, role, canScanQr status, assigned gate
- **Edit volunteer** — change role, toggle QR scanning, assign gate
- **Remove volunteer** — delete assignment
- **Activity log** — view all scans by a volunteer (paginated)

### Volunteer Roles
- `volunteer` — basic volunteer
- `assistant` — event assistant
- `manager` — area manager
- `event_manager` — full event manager

### Assignment Flow

```
Creator opens Volunteers tab → Clicks "Add Volunteer"
  → IF event is club-linked: Shows club members with "Already Assigned" flag
  → Selects user → Assigns role + permissions
  → Volunteer appears in list
  → Volunteer can now scan QR codes (if canScanQr = true)
```

### What to Test
1. **Assign volunteer** — user added, appears in list
2. **Club members** — correct members shown for club events
3. **Already assigned** — flag shown correctly, cannot double-assign (`@@unique([eventId, userId])`)
4. **Edit volunteer** — role, gate, scanning permission update correctly
5. **Remove volunteer** — volunteer deleted
6. **canScanQr toggle** — volunteer can/cannot access scan page
7. **Activity log** — shows all scans by volunteer with timestamps

---

## 13. Module 11 — Certificate System

### Overview
Event creators can design certificates with a visual editor, then send personalized PDFs to event registrants via email.

### Certificate Template Management

| Action | API | Detail |
|--------|-----|--------|
| Upload template | `POST /:id/certificates/templates` | Upload background image (PNG/JPG/SVG, max 1MB) |
| List templates | `GET /:id/certificates/templates` | Returns templates with presigned S3 URLs |
| Update template | `PATCH /:id/certificates/templates/:templateId` | Update title, content, text color, name, type |
| Delete template | `DELETE /:id/certificates/templates/:templateId` | Deletes template + S3 image |

### Certificate Design (Visual Editor in CertificateSlider)

**Step 1: Template Selection**
- Browse uploaded templates with image previews
- Upload new template image
- Select template to proceed

**Step 2: Configure (Visual Editor)**
- **Canvas preview** — A4 landscape with template image as background
- **Text fields** — draggable overlays on canvas:
  - Add text field → positioned at center
  - Edit text content (supports placeholders)
  - Change font size, color, weight (bold), alignment (left/center/right)
  - Drag to reposition (updates x%, y% coordinates)
  - Delete text field
- **Image overlays** — drag-and-drop images (logos, signatures)
  - Upload → stored in S3
  - Position (x%, y%), resize (width %)
  - Delete overlay
- **Placeholders:** `[Candidate Name]`, `[Event Name]`, `[Organizer]`, `[Team Name]`, `[Candidate's Organisation Name]`, `[Date]`
- **Undo** — undo last text/image change
- **Test send** — enter email address → sends single test certificate

**Step 3: Recipients & Send**
- **Status filter** — All / Confirmed / Pending / Cancelled / Selected (from checkbox selection)
- **Recipient count** — shows how many will receive
- **Duplicate detection** — checks if any recipients already received a certificate for this event
  - If duplicates found → shows warning: "X recipients have already been sent a certificate."
  - **Option 1: Skip Already Sent** — sends only to new recipients
  - **Option 2: Resend Anyway** — sends to all (preserves original verification IDs)
- **Send button** — triggers bulk generation + delivery

### Certificate Generation Pipeline

```
Send button clicked → Backend:
  1. Build recipient list (filter by status or specific IDs)
  2. Resolve names (studentLogin → employeeDetails → fallback)
  3. Deduplicate by email
  4. Check for existing certificates (duplicate detection)
  5. Create EventCertificateLog
  6. Create CertificateRecipientLog per recipient (with verificationCode)
  7. For each recipient (10 parallel):
     a. Replace [Placeholders] with actual data
     b. Render HTML → Puppeteer → PDF buffer
     c. Upload PDF to S3
     d. Build email HTML (with verify link)
     e. Send via SendGrid (PDF attached)
  8. Update log: sentCount, failedCount, status
  9. Update per-recipient: status (sent/failed), S3 key, timestamps
```

### Verification ID Rules (CRITICAL)
- Every certificate recipient gets a permanent `verificationCode` (UUID)
- This code is printed on the certificate PDF and in the verify email link
- **If certificate is resent (Resend Anyway), the SAME verificationCode is reused**
- The existing `CertificateRecipientLog` row is updated (not duplicated)
- Verification link: `/verify/certificate/[verificationCode]` always works

### Certificate History
- Lists all send operations with: type, title, filter, counts, status, sender, timestamp
- Shows errors for partial/failed sends

### What to Test
1. **Upload template** — image uploads correctly, appears in gallery
2. **File type validation** — only PNG/JPG/SVG accepted, max 1MB enforced
3. **Visual editor** — text fields draggable, font/color/size changes apply
4. **Placeholders** — `[Candidate Name]` replaced with actual name in generated PDF
5. **Test send** — single certificate generated and emailed correctly
6. **Bulk send** — certificates sent to correct recipients based on filter
7. **PDF quality** — text positions match editor layout, image is crisp
8. **S3 storage** — PDF uploaded, downloadable via presigned URL
9. **Email delivery** — email received with correct content + PDF attachment
10. **Verification link** — link in email opens public verification page, shows "Verified"
11. **Duplicate detection** — warning shows correct count when resending
12. **Skip Already Sent** — only new recipients receive certificates
13. **Resend Anyway** — all recipients get new PDF, same verification code
14. **Verification ID persistence** — after resend, old verification link still works (same code)
15. **Failed sends** — correct failure count, per-recipient error logged
16. **History log** — shows all past send operations with accurate counts
17. **Download certificate** — authenticated user can download their own certificate PDF
18. **Download denied** — user cannot download another user's certificate

---

## 14. Module 12 — Bulk Email System

### Overview
Event creators can send styled emails to registrants with open tracking, scheduling, and credit management.

### Email Credits System
- **3 credits per registration** (allocated when new registered)
- **1 credit = 1 email to 1 recipient**
- Credits **never recovered** on registration cancellation
- Credit balance displayed in compose panel

### Email Compose (EmailSlider)

| Field | Detail |
|-------|--------|
| Subject | Text input, prefilled: "Update regarding [EventName]" |
| Body | Rich text editor (React Quill) with bold, italic, underline, lists, alignment, links |
| Recipients | Filter: All / Confirmed / Pending / Cancelled / Selected (pre-selected IDs) |
| Reply-To | Optional toggle + email input |
| Schedule | Optional: date picker + time picker (must be future) |
| Test email | Send preview to any email address |

### Email Sending Flow

```
Compose email → Select recipients → Click Send
  → Backend:
    1. Check credit balance (available >= recipientCount)
    2. Build recipient list (resolve names, deduplicate)
    3. Create EventEmailLog
    4. Create EmailRecipientLog per recipient
    5. Send via SendGrid (with open tracking pixel)
    6. Deduct credits
    7. Update log: sentCount, failedCount, status
```

### Open Tracking
- Each email has a 1×1 pixel image embedded: `GET /events/emails/track/:recipientLogId/open.png`
- Backend increments `openCount`, records `firstOpenedAt` and `lastOpenedAt`
- Returns transparent 1×1 PNG

### Scheduled Emails
- If `scheduledAt` is provided, email is saved with status `scheduled`
- Background job (`emailScheduler.service.js`) runs periodically, picks up and sends
- Creator can cancel scheduled email before send time

### Email History
- Lists all sent/scheduled emails: subject, recipient count, sent/failed counts, status, timestamp
- Expand per-email: per-recipient delivery details (sent/delivered/bounced/failed, open count)
- Filter history: all / delivered / opened / not_opened / failed

### What to Test
1. **Subject validation** — required, cannot send empty
2. **Body validation** — required, cannot send empty
3. **Recipient count** — correct per filter
4. **Credit check** — send blocked if insufficient credits
5. **Send immediate** — emails delivered
6. **Schedule future** — email saved as "scheduled", not sent yet
7. **Cancel scheduled** — changes status to "cancelled", not sent
8. **Past datetime** — schedule validation rejects past dates
9. **Test email** — sent to test address, no credits deducted
10. **Open tracking** — pixel loads incrementing open count
11. **Reply-to** — reply-to header set correctly in delivered email
12. **Per-recipient status** — sent/delivered/bounced/failed tracked
13. **Credit deduction** — correct number of credits deducted (= recipientCount)
14. **History accuracy** — counts, timestamps, sender name
15. **Rich text** — bold, italic, links render correctly in delivered email

---

## 15. Module 13 — Stall Management

### Overview
Events (especially festivals) can have stalls. Two sources:
1. **Creator stalls** — event organizer adds stalls directly
2. **Student-applied stalls** — students apply, organizer reviews

### Stall Application Flow (Student)

```
Student browses Stall Opportunities → Clicks "Apply"
  → Fill application form:
    - Stall name, type (Food/Product/Service/Information/Other)
    - Description, business name
    - Contact: phone, email
    - Selling? price range
    - Stall size: 6x6, 10x10, custom
    - Infrastructure needs: electricity, table, chairs, special setup
    - Category: Standard, Premium, Sponsored
    - Payment: fees, mode, transaction ID, screenshot
    - Documents upload
    - Accept rules, refund policy, safety compliance
  → Submit → Application status = "pending"
  → Organizer reviews → Approves / Rejects (with reason)
  → If approved: Stall created with source = "student-approved"
```

### Stall Management (Creator)

| Action | API | Detail |
|--------|-----|--------|
| Create stall | `POST /:id/stalls` | Direct creation by organizer |
| List stalls | `GET /:id/stalls` | All stalls for event |
| Update stall | `PATCH /:id/stalls/:stallId` | Edit stall details |
| Delete stall | `DELETE /:id/stalls/:stallId` | Remove stall |
| Toggle applications | `PATCH /:id/stall-applications/toggle-open` | Open/close application portal |
| Review application | `PATCH /:id/stall-applications/:appId` | Approve/reject with feedback |
| Bulk review | `PATCH /:id/stall-applications/bulk` | Bulk approve/reject |
| List applications | `GET /:id/stall-applications` | View all applications |

### Stall Feedback
- Each stall gets its own QR code
- Customers scan QR → submit 1-10 rating + optional text
- Stall owner can view their feedback
- Event creator can view all stall feedback

### What to Test
1. **Application form** — all fields validate, required fields enforced
2. **File uploads** — documents + payment screenshot upload
3. **Application submit** — creates with status "pending"
4. **Organizer review** — approve/reject with reason
5. **Bulk review** — multiple applications processed at once
6. **Toggle portal** — open/close application portal
7. **Creator stall** — direct creation, appears in stall list
8. **Stall update** — all fields editable
9. **Stall delete** — removes stall
10. **Stall QR code** — unique per stall, scannable
11. **Stall feedback** — 1-10 rating + text, submitted correctly
12. **Stall owner view** — owner sees own stall's feedback only
13. **Stall opportunities page** — correct events shown, application status badges

---

## 16. Module 14 — Feedback System

### Event Feedback (Public, No Auth Required)

| Field | Type |
|-------|------|
| Points | Array of 10 ratings (1-10 each) — 10 different criteria |
| Short description | Optional text (up to 2000 chars) |

### Stall Feedback (Public, No Auth Required)

| Field | Type |
|-------|------|
| Points | Array of ratings (1-10) |
| Short description | Optional text |

### Feedback Submission Flow

```
User scans feedback QR → lands on feedback page
  → Sees event/stall info
  → Rates on 1-10 scale (10 criteria for events)
  → Optional text feedback
  → Submits
  → Thank you screen
```

### Creator/Admin View
- Aggregate ratings per criterion (average, distribution)
- Text feedback list
- Filter by date range

### What to Test
1. **Rating required** — cannot submit without rating (min 1)
2. **Rating scale** — 1-10 clickable buttons per criterion
3. **Optional text** — submit with or without text
4. **Character limit** — max 2000 chars
5. **Public access** — no login required for feedback
6. **Invalid stall/event** — "not found" shown
7. **Creator view** — aggregate ratings accurate
8. **Multiple submissions** — verify if user can submit multiple feedback (no unique constraint in schema)

---

## 17. Module 15 — Prize Management

### Prize Fields

| Field | Type | Detail |
|-------|------|--------|
| position | Int | 1 = 1st, 2 = 2nd, etc. |
| rank | String | "Winner", "Runner-up", "Custom Title" |
| title | String | Prize title |
| description | String? | Prize description |
| prizeType | Enum | `certificate`, `cash`, `scholarship`, `internship`, `award`, `other` |
| prizeAmount | Float? | ₹ amount (for cash prizes) |
| additionalPerks | JSON? | Extra perks (certificate, internship offer, etc.) |
| sortOrder | Int | Display ordering |
| isActive | Boolean | Soft toggle |

### API Endpoints

| Action | API |
|--------|-----|
| List | `GET /:id/prizes` |
| Get one | `GET /:id/prizes/:prizeId` |
| Create | `POST /:id/prizes` |
| Update | `PATCH /:id/prizes/:prizeId` |
| Delete | `DELETE /:id/prizes/:prizeId` |
| Bulk upsert | `POST /:id/prizes/bulk` |
| Reorder | `PATCH /:id/prizes/reorder` |
| Toggle feature | `PATCH /:id/prizes-enabled` |

### What to Test
1. **Create prize** — all fields saved correctly
2. **Prize types** — each enum type selectable
3. **Cash amount** — displayed correctly with ₹ formatting
4. **Ordering** — reorder updates sort correctly
5. **Bulk upsert** — create + update in single call
6. **Toggle enabled** — `prizesEnabled` flag changes, section shown/hidden on event page
7. **Delete prize** — removed from list
8. **Public visibility** — prizes shown on event detail page when enabled

---

## 18. Module 16 — Event Settings & Visibility

### Visibility Settings

| Field | Type | Description |
|-------|------|-------------|
| `isActive` | Boolean | Event ON/OFF toggle |
| `visibleToRoles` | JSON Array | Roles that can see: `["student","faculty","staff","parent","admin"]` |
| `studentFilterType` | "all" / "custom" | If "custom", apply granular filters |
| `allowedSchoolIds` | UUID[] | Filter by school |
| `allowedDepartmentIds` | UUID[] | Filter by department |
| `allowedProgramIds` | UUID[] | Filter by program |
| `allowedBatchYears` | Int[] | Filter by batch/admission year |
| `allowedSectionIds` | UUID[] | Filter by section |

### API Endpoints

| Action | API |
|--------|-----|
| Get settings | `GET /:id/settings` |
| Update settings | `PUT /:id/settings` |
| Toggle active | `PATCH /:id/settings/toggle-active` |
| Get hierarchy data | `GET /hierarchy/data` |

### Hierarchy Data (for filter UI)
Returns: schools → departments → programs → batch years → sections — used in the settings UI to configure visibility filters.

### What to Test
1. **isActive toggle** — event hidden/shown when toggled
2. **Role filter** — student excluded when "student" not in `visibleToRoles`
3. **Custom student filter:**
   - Allowed school: only students in that school see event
   - Allowed department: only that department
   - Allowed program: only that program
   - Allowed batch year: only that batch
   - Combined filters: all conditions must match (AND logic)
4. **Hierarchy data** — correct schools/departments/programs/batches loaded
5. **Empty filters** — if "custom" but no filters set, what happens? (likely shows to none or all)
6. **Admin override** — admin/superadmin can always see regardless of filters

---

## 19. Module 17 — Custom Registration Fields

### Overview
Event creators can add custom form fields to the registration form.

### Supported Field Types

| Type | UI Component |
|------|-------------|
| `text` | Single-line text input |
| `textarea` | Multi-line text area |
| `number` | Numeric input |
| `email` | Email-validated input |
| `phone` | Phone number input |
| `url` | URL input |
| `date` | Date picker |
| `time` | Time picker |
| `datetime` | DateTime picker |
| `dropdown` | Select from options |
| `radio` | Single choice from list |
| `checkbox` | Multiple choice from list |
| `file` | File upload |
| `image` | Image upload |

### Field Configuration

| Property | Type | Description |
|----------|------|-------------|
| `fieldName` | String (128) | Internal name |
| `fieldLabel` | String (256) | Display label |
| `fieldType` | Enum | One of above types |
| `isRequired` | Boolean | Mandatory field |
| `placeholder` | String? | Placeholder text |
| `helpText` | String? | Help description below field |
| `options` | JSON? | Options for dropdown/radio/checkbox |
| `validationRules` | JSON? | Min/max length, regex pattern |
| `defaultValue` | String? | Pre-filled value |
| `sortOrder` | Int | Display order |
| `isActive` | Boolean | Visible on form |

### API Endpoints

| Action | API |
|--------|-----|
| Get fields | `GET /:id/custom-fields` |
| Create field | `POST /:id/custom-fields` |
| Update field | `PATCH /:id/custom-fields/:fieldId` |
| Delete field | `DELETE /:id/custom-fields/:fieldId` |
| Reorder | `PATCH /:id/custom-fields/reorder` |
| Get registration settings | `GET /:id/registration-settings` |
| Update registration settings | `PATCH /:id/registration-settings` |

### What to Test
1. **Each field type renders** correctly on the registration form
2. **Required validation** — submit blocked if required field empty
3. **Dropdown/radio/checkbox** — options render and are selectable
4. **File upload** — correct types accepted, size limits
5. **Reorder** — sort order changes reflected on form
6. **Delete field** — removed from form, existing responses preserved
7. **Default value** — pre-filled when form loads
8. **Help text** — displayed below field
9. **Validation rules** — min/max length, regex patterns enforced
10. **Field responses saved** — stored in `EventFieldResponse`, visible in registration detail

---

## 20. Module 18 — My Registrations / Tickets

### Page: `/events/registrations`

### UI Components
- **Status tabs** — All Tickets / Active / Pending / Waitlist / Cancelled
- **Ticket cards** — event name, date, venue, status badge, registration ID, QR code
- **QR code modal** — enlarged preview on click
- **Download QR** — saves QR as PNG image
- **Empty state** — "No registrations" with link to browse events
- **Pagination** — if many registrations

### What to Test
1. **Correct registrations** — only user's own registrations shown
2. **Status filter** — each tab shows correct registrations
3. **Status badges** — color-coded (green=confirmed, amber=pending, red=cancelled, gray=waitlisted)
4. **QR code display** — QR visible on card, enlargeable in modal
5. **QR download** — downloads PNG with correct QR data
6. **Event link** — clicking event name navigates to event detail
7. **Payment status** — shown for paid events (paid/pending/failed/refunded)
8. **Team info** — shown for team-based events
9. **Entry status** — "Entered" with timestamp if scanned
10. **Empty state** — shows when no registrations exist

---

## 21. Module 19 — My Certificates

### Page: `/events/my-certificates`

### UI Components
- **Certificate cards** — title, event name, issue date, type badge, download button, verify button
- **Download** — opens presigned S3 URL for PDF (5 min expiry)
- **Verify** — opens `/verify/certificate/[code]` in new tab
- **Pagination** — Previous/Next buttons
- **Empty state** — "No Certificates Yet"

### Business Rule: Latest Certificate Per Event
- If a user received multiple certificates for the same event (e.g., certificate resent), **only the latest one** is shown.
- Older certificates for the same event are hidden from the list.

### What to Test
1. **Latest per event** — if user has 2 certificates for Event A, only newest is shown
2. **Download works** — PDF opens/downloads correctly
3. **Verify link** — opens verification page showing "Verified"
4. **Type badge** — "Participation" / "Winner" / other type
5. **Issue date** — correct date displayed
6. **Download unavailable** — button disabled if no S3 key
7. **Pagination** — works correctly when many certificates
8. **Only own certificates** — cannot see other users' certificates

---

## 22. Module 20 — Certificate Verification (Public)

### Page: `/verify/certificate/[code]`

### No Authentication Required

### States

| State | Display |
|-------|---------|
| **Loading** | Spinner + "Verifying Certificate..." |
| **Verified** | Green checkmark, certificate details, event info, verification ID |
| **Not Found** | Red X icon, "Verification Failed", "Invalid Certificate" alert |
| **Invalid Code** | 400 error if code is not valid UUID format |

### Verified Display
- Certificate title, holder name, type, issue date
- Event name, event ID
- Issuing organization: "SGT University"
- Verification ID (unique code, monospace display)
- Verification timestamp

### What to Test
1. **Valid code** — shows "Certificate Verified" with all details
2. **Invalid code** — shows "Verification Failed"
3. **Non-UUID format** — shows "Invalid verification code"
4. **Certificate not yet sent** (status = pending) — "Certificate not found or not yet issued"
5. **Failed certificate** (status = failed) — "Certificate not found or not yet issued"
6. **Resent certificate** — same verification code still works (verification ID never changes)
7. **Public access** — works without login
8. **Correct data** — holder name, event name, dates match actual data

---

## 23. Module 21 — Stall Opportunities (Student View)

### Page: `/events/stall-opportunities`

### UI Components
- **Search bar** — filter by event name
- **Tab navigation** — All Events / Ongoing / Upcoming / My Applications / Past
- **Opportunity cards** (3-column grid):
  - Status badge (event status)
  - Application badge (if applied: Pending/Accepted/Rejected)
  - Event name (clickable)
  - Venue
  - Event dates, application deadline (red if expired)
  - Stall fee (Free or ₹X)
  - Availability ("X spots left")
  - Apply button (hidden if already applied or deadline passed)

### What to Test
1. **Search** — filters events by name
2. **Tab filtering** — correct events per tab
3. **My Applications** — shows only events user applied to
4. **Application status** — correct badge (Pending/Accepted/Rejected)
5. **Apply button** — hidden when deadline passed or already applied
6. **Deadline display** — red if expired
7. **Fee display** — "Free" vs "₹X" formatting
8. **Availability** — correct count of remaining spots
9. **Click event** — navigates to event detail

---

## 24. Module 22 — Event Analytics

### Analytics Tab (inside Management Dashboard)

### Data Points
- Total registrations (with trend chart)
- Registrations by status (pie chart)
- Daily registration trend (line chart, cumulative)
- Attendance rate (entered / confirmed)
- Revenue (total payments collected)
- Payment status breakdown
- Top referral sources
- Gender distribution
- School/department distribution
- Entry/exit timeline

### What to Test
1. **Chart data accuracy** — matches raw registration data
2. **Trend chart** — cumulative daily registrations, no gaps
3. **Pie chart** — status breakdown adds up to total
4. **Attendance rate** — correct percentage
5. **Revenue** — sum of all `amountPaid` for completed payments
6. **Gender/school distribution** — correct grouping from actual data
7. **Empty event** — charts show "No data" gracefully

---

## 25. Database Enums Reference

| Enum | Values |
|------|--------|
| **EventType** | `seminar`, `workshop`, `fest`, `conference`, `competition`, `cultural`, `technical`, `sports`, `other` |
| **EventPaymentType** | `free`, `paid` |
| **EventStatus** | `draft`, `published`, `ongoing`, `completed`, `cancelled` |
| **OpportunityMode** | `online`, `offline`, `hybrid` |
| **ParticipationType** | `individual`, `team` |
| **RegistrationStatus** | `draft`, `pending`, `confirmed`, `cancelled`, `waitlisted`, `rejected`, `incomplete_team` |
| **PaymentStatus** | `pending`, `completed`, `failed`, `refunded` |
| **EntryType** | `entry`, `exit` |
| **EventTeamStatus** | `forming`, `complete`, `confirmed`, `disqualified`, `withdrawn` |
| **EventTeamMemberRole** | `leader`, `member`, `co-leader` |
| **EventTeamMemberStatus** | `confirmed`, `pending`, `rejected`, `left` |
| **EventInvitationStatus** | `pending`, `accepted`, `declined`, `expired`, `cancelled` |
| **EventRequestStatus** | `pending`, `accepted`, `rejected`, `cancelled` |
| **EventFieldType** | `text`, `textarea`, `number`, `email`, `phone`, `url`, `date`, `time`, `datetime`, `dropdown`, `radio`, `checkbox`, `file`, `image` |
| **CouponDiscountType** | `percentage`, `fixed` |
| **PrizeType** | `certificate`, `cash`, `scholarship`, `internship`, `award`, `other` |

---

## 26. API Endpoints Summary

### Public Endpoints (No Auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/events/payments/webhook` | Razorpay webhook |
| POST | `/events/:id/feedback` | Submit event feedback |
| GET | `/events/:id/feedback-info` | Feedback form config |
| POST | `/events/:id/stalls/:stallId/feedback` | Submit stall feedback |
| GET | `/events/:id/stalls/:stallId/feedback-info` | Stall feedback form |
| GET | `/events/certificates/verify/:code` | Verify certificate |

### Authenticated User Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/events` | List events |
| GET | `/events/:id` | Event detail |
| POST | `/events/:id/register` | Register for event |
| POST | `/events/:id/register-with-form` | Submit form + register |
| GET | `/events/:id/registration-form` | Get registration form |
| GET | `/events/registrations/my` | My registrations |
| GET | `/events/registration-dashboard` | Registration dashboard |
| GET | `/events/profile-data` | Profile data for form |
| GET | `/events/volunteers/my` | My volunteer assignments |
| GET | `/events/volunteers/my/activity` | My scan history |
| GET | `/events/stall-opportunities` | Stall opportunities |
| GET | `/events/hierarchy/data` | Hierarchy data for filters |
| GET | `/events/certificates/my` | My certificates |
| GET | `/events/certificates/download/:code` | Download certificate PDF |
| POST | `/events/:id/coupons/validate` | Validate coupon |
| POST | `/events/:id/payments/individual/create-order` | Create payment order |
| POST | `/events/:id/payments/individual/verify` | Verify payment |
| GET | `/events/:id/payments/status` | Payment status |

### Team Endpoints (Authenticated)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/events/:id/teams` | Create team |
| GET | `/events/:id/my-team` | Get my team |
| GET | `/events/:id/teams/:teamId` | Team details |
| POST | `/events/:id/teams/:teamId/finalize` | Finalize team |
| POST | `/events/:id/teams/:teamId/invite` | Invite to team |
| POST | `/events/:id/teams/:teamId/request-join` | Request to join |
| GET | `/events/:id/invitations/my` | My invitations |
| GET | `/events/:id/requests/my` | My join requests |
| POST | `/events/:id/invitations/:id/respond` | Respond to invitation |
| POST | `/events/:id/requests/:id/respond` | Respond to join request |
| DELETE | `/events/:id/teams/:teamId/members/:memberId` | Remove member |
| DELETE | `/events/:id/teams/:teamId` | Cancel team |
| GET | `/events/:id/teams/looking-for-members` | Teams seeking members |
| GET | `/events/:id/users-looking-for-teammates` | Users seeking teammates |
| PATCH | `/events/:id/teams/:teamId/looking-for-members` | Toggle team open |
| PATCH | `/events/:id/looking-for-teammates` | Toggle user seeking |
| GET | `/events/:id/search-users` | Search users to invite |
| POST | `/events/:id/teams/:teamId/payments/create-order` | Team payment order |
| POST | `/events/:id/teams/:teamId/payments/verify` | Team payment verify |

### Event Management Endpoints (Requires `event_manage_own/all`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| PATCH | `/events/:id` | Update event |
| POST | `/events/:id/publish` | Publish event |
| GET | `/events/:id/statistics` | Event statistics |
| GET | `/events/:id/registrations` | List registrations |
| GET | `/events/:id/registrations/filter-options` | Filter dropdown options |
| GET | `/events/:id/registrations/:regId/details` | Registration detail |
| POST | `/events/:id/volunteers` | Assign volunteer |
| GET | `/events/:id/volunteers` | List volunteers |
| PATCH | `/events/:id/volunteers/:id` | Update volunteer |
| DELETE | `/events/:id/volunteers/:id` | Remove volunteer |
| GET | `/events/:id/volunteers/:id/activity` | Volunteer activity |
| GET | `/events/:id/club-members` | Club members |
| POST | `/events/:id/scan` | Scan QR code |
| GET | `/events/:id/feedback` | Event feedback |
| GET | `/events/:id/stalls/:stallId/feedback` | Stall feedback |
| POST | `/events/:id/certificates/templates` | Upload cert template |
| GET | `/events/:id/certificates/templates` | List cert templates |
| PATCH | `/events/:id/certificates/templates/:id` | Update template |
| DELETE | `/events/:id/certificates/templates/:id` | Delete template |
| GET | `/events/:id/certificates/recipients-count` | Recipient counts |
| POST | `/events/:id/certificates/send` | Send certificates |
| POST | `/events/:id/certificates/test-send` | Test certificate |
| GET | `/events/:id/certificates/history` | Certificate history |
| GET | `/events/:id/emails/credits` | Email credits |
| GET | `/events/:id/emails/recipients-count` | Email recipient counts |
| POST | `/events/:id/emails/send` | Send bulk email |
| GET | `/events/:id/emails/history` | Email history |
| GET | `/events/:id/emails/analytics` | Email analytics |
| DELETE | `/events/:id/emails/scheduled/:logId` | Cancel scheduled email |
| GET | `/events/:id/emails/:logId` | Email detail |
| GET | `/events/:id/emails/:logId/recipients` | Email recipients |
| GET | `/events/:id/coupons` | List coupons |
| POST | `/events/:id/coupons` | Create coupon |
| PATCH | `/events/:id/coupons/:id` | Update coupon |
| DELETE | `/events/:id/coupons/:id` | Delete coupon |
| GET | `/events/:id/prizes` | List prizes |
| POST | `/events/:id/prizes` | Create prize |
| PATCH | `/events/:id/prizes/:id` | Update prize |
| DELETE | `/events/:id/prizes/:id` | Delete prize |
| POST | `/events/:id/prizes/bulk` | Bulk upsert prizes |
| PATCH | `/events/:id/prizes/reorder` | Reorder prizes |
| PATCH | `/events/:id/prizes-enabled` | Toggle prizes |
| GET | `/events/:id/settings` | Get visibility settings |
| PUT | `/events/:id/settings` | Update settings |
| PATCH | `/events/:id/settings/toggle-active` | Toggle event ON/OFF |
| GET | `/events/:id/registration-settings` | Get registration settings |
| PATCH | `/events/:id/registration-settings` | Update registration settings |
| GET | `/events/:id/custom-fields` | Get custom fields |
| POST | `/events/:id/custom-fields` | Create custom field |
| PATCH | `/events/:id/custom-fields/:fieldId` | Update custom field |
| DELETE | `/events/:id/custom-fields/:fieldId` | Delete custom field |
| PATCH | `/events/:id/custom-fields/reorder` | Reorder fields |
| POST | `/events/:id/stall-applications` | Submit stall application |
| GET | `/events/:id/stall-applications` | List applications |
| PATCH | `/events/:id/stall-applications/:id` | Review application |
| PATCH | `/events/:id/stall-applications/bulk` | Bulk review |
| PATCH | `/events/:id/stall-applications/toggle-open` | Toggle portal |
| GET | `/events/:id/stalls` | List stalls |
| POST | `/events/:id/stalls` | Create stall |
| PATCH | `/events/:id/stalls/:stallId` | Update stall |
| DELETE | `/events/:id/stalls/:stallId` | Delete stall |

---

## 27. Test Scenarios & Edge Cases

### Critical Flows — Happy Path

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Event Discovery | Login as student → Browse `/events` → Search → Click event | Event list loads, search filters work, event detail opens |
| 2 | Individual Registration (Free) | Open event → Click Register → Fill form → Submit | Registration created, QR generated, ticket visible in "My Registrations" |
| 3 | Individual Registration (Paid) | Open paid event → Fill form → Apply coupon → Submit → Complete Razorpay payment | Payment verified, registration confirmed, correct amount after discount |
| 4 | Team Registration | Open team event → Create team → Invite members → Members accept → Finalize → Pay | Team created, all members registered, payment for team processed |
| 5 | QR Attendance | Volunteer opens scan page → Scans entry QR → Scans exit QR | Entry recorded, exit recorded, student marked as entered |
| 6 | Certificate Distribution | Creator opens Registrations → Clicks "Send Certificates" → Designs → Sends | Certificates emailed, PDFs in S3, verification links work |
| 7 | Certificate Verification | Recipient opens verify link from email | "Certificate Verified" page with correct details |
| 8 | Bulk Email | Creator opens email slider → Composes → Selects recipients → Sends | Emails delivered, credits deducted, open tracking works |
| 9 | Stall Application | Student browses stall opportunities → Applies → Creator approves | Application submitted, stall created on approval |
| 10 | Event Feedback | User scans feedback QR → Rates 1-10 → Submits | Feedback saved, visible in creator dashboard |

### Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Register for full-capacity event | Show "Registration Full" or add to waitlist |
| 2 | Register outside registration period | "Registration is not open" error |
| 3 | Double registration (same event) | "Already registered" error |
| 4 | Payment fails mid-transaction | Registration stays "pending", webhook handles delayed capture |
| 5 | Verify certificate after resend | Same verification ID → page shows "Verified" |
| 6 | Scan QR for cancelled registration | "Registration is cancelled" error |
| 7 | Double entry scan (without exit) | "Already entered" error |
| 8 | Exit scan without prior entry | "No entry record found" error |
| 9 | Expired coupon code | "This coupon has expired" error |
| 10 | Coupon at max usage | "Maximum usage limit reached" error |
| 11 | Send email with 0 credits | "Insufficient email credits" error |
| 12 | Schedule email in the past | Validation rejects past datetime |
| 13 | Access management page as student | 403 Forbidden |
| 14 | Volunteer without canScanQr accesses scan | 403 Forbidden |
| 15 | Max team size reached + invite | Invite blocked |
| 16 | Finalize team below min size | Finalization blocked |
| 17 | View event with restricted visibility | Event not found / hidden |
| 18 | Upload template > 1MB | "File too large" error |
| 19 | Upload non-image template | "Only PNG, JPG, SVG allowed" error |
| 20 | Certificate send to 100+ recipients | Processes in batches of 10 with rate limiting |
| 21 | My Certificates — multiple certs same event | Only latest certificate shown |
| 22 | Duplicate certificate send (resend) | Warning shown with skip/resend options; verification ID preserved |
| 23 | Download another user's certificate | 403 "Access denied" |
| 24 | Team payment — member leaves before payment | Handle gracefully |
| 25 | Cancel scheduled email | Status changes to "cancelled", email not sent |
| 26 | Event deactivated (isActive = false) | Event hidden from discovery |
| 27 | Concurrent coupon usage (last coupon) | Atomic counter prevents overselling |
| 28 | Custom field: file upload too large | Error shown, submission blocked |
| 29 | Required custom field left empty | Inline validation error |
| 30 | Team invitation expired | Cannot accept expired invitation |

### Permission Matrix Tests

| # | User | Action | Expected |
|---|------|--------|----------|
| 1 | Student | Browse events | Only visible events (per visibility settings) |
| 2 | Student | Access `/events/[id]/management` | 403 Forbidden |
| 3 | Student | Register for event | Allowed (if registration open) |
| 4 | Faculty (creator) | Access own event management | Allowed |
| 5 | Faculty (creator) | Access other's event management | 403 Forbidden |
| 6 | Admin | Access any event management | Allowed |
| 7 | Volunteer (canScanQr=true) | Scan QR | Allowed |
| 8 | Volunteer (canScanQr=false) | Scan QR | 403 Forbidden |
| 9 | Student (club chairperson) | Manage club event | Allowed |
| 10 | Student (not chairperson) | Access event management | 403 Forbidden |

---

*End of PRD — Version 2.0*
