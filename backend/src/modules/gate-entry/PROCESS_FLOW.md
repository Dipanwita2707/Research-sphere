# Gate Entry Module - Complete Process Flow

This document explains the complete Gate Entry flow in simple language so any team member can understand it quickly.

---

## 1. Purpose of Module

Gate Entry module handles:

- Visitor pass creation
- Guard-side verification (QR/manual)
- Entry and exit tracking
- Multi-day re-entry handling
- Pass cancellation and checkout workflow
- Pass extension
- Hostel/guest-house booking flow
- Early check-in and room cancellation requests
- Analytics and reporting    

---

## 2. Main Actors

- Student/Faculty/Staff/Admin (Pass Creator)
- Security Guard (Verify/Entry/Exit actions)
- Admin (Analytics, config, refunds oversight)
- Visitor (Uses QR/code at gate)
- Parent/Guardian (Gets booking-related notifications in hostel flow)

---

## 3. High-Level End-to-End Flow

1. Creator opens `Create Pass` page.
2. Creator fills visitor details and submits.
3. System validates data and duplicate conflicts.
4. System creates pass, generates QR + verification code, sets pass status.
5. Guard verifies pass at gate (QR scan or manual search).
6. Guard performs action:
- Allow Entry
- Deny Entry
- Record Exit
- Cancel + Checkout (if required)
7. Optional branches:
- Hostel booking + payment + approval flows
- Early check-in request
- Room cancellation request
- Pass extension
8. System records history/daily entries and updates analytics.

---

## 4. Core Pass Lifecycle (Status Flow)

Primary status (`pass_status`) journey:

1. `created` -> pass created, waiting for entry
2. `checked_in` -> visitor entered
3. `checked_out` -> visitor exited (can re-enter within validity window)
4. `cancelled` -> pass cancelled (before or after check-in)
5. `expired` -> validity ended

Legacy `status` field is also updated for backward compatibility.

---

## 5. Detailed Flow by Feature

## 5.1 Pass Creation Flow

1. Client sends `POST /api/v1/gate-entry/create-pass`.
2. Backend maps form fields and validates:
- required visitor and timing fields
- purpose
- vehicle rules (if vehicle enabled)
3. Duplicate check is performed (`mobile + name + date overlap`).
4. For student creators, relation rules are applied.
5. System generates:
- `pass_id` (unique)
- entry verification code
- QR code
- checkout expiry baseline
6. Pass is saved in DB.
7. Email notification is attempted (fire-and-forget).

Output: created pass object with IDs/timestamps/status.

---

## 5.2 Verify/Search Flow (Guard)

1. Guard uses .
2. Search input can be:
- pass ID
- mobile
- visitor name
- vehicle number
- checkout QR payload
3. System returns pass + guard action context.
4. Guard UI decides which action buttons to show based on:
- role/permission
- pass status
- cancellation/checkout state
- QR activation window

---

## 5.3 Allow Entry Flow

1. Guard triggers .
2. Backend checks:
- pass exists
- valid state for entry (`created` or allowed re-entry case)
- QR active rules
- optional verification code match (manual path)
3. System updates pass:
- `pass_status = checked_in`
- entry time/gate/guard/remarks
4. Daily entry row is created for in/out tracking.
5. Success response + email attempt.

---

## 5.4 Record Exit Flow

1. Guard triggers .
2. Backend ensures visitor is currently checked in.
3. Optional verification code is validated for manual exit.
4. System updates:
- `pass_status = checked_out`
- exit time/gate/guard/remarks
5. Latest open daily entry row is closed with exit data.
6. Success response + email attempt.

---

## 5.5 Cancel Pass Flow (Important Branch)

Cancellation path depends on current status:

1. If `created`:
- cancel before check-in
- optional hostel refund logic applied
- cancellation type marked

2. If `checked_in`:
- cancel after check-in
- checkout credentials generated (checkout unique ID/code/QR)
- visitor must complete final checkout

3. If `checked_out`:
- cancel from checked-out state (final close)

Guard/admin/creator permission rules apply contextually.

---

## 5.6 Checkout for Cancelled-Inside Visitor


1. Used when pass was cancelled after check-in.
2. Guard verifies checkout QR/code.
3. System records final exit and closes visitor movement safely.

---

## 5.7 Multi-Day Daily Entry Tracking

For multi-day or repeated in/out movement:

- every entry creates a daily entry row
- corresponding exit closes that row
- guard can see complete in/out timeline

This is useful for hostel/overnight scenarios and audit.

---

## 5.8 Pass Extension Flow

Flow:

1. Check extension options and date validity.
2. If hostel booking exists:
- decide same room vs alternate room
- recalculate amount and payment requirement
3. Update pass end date, extension counters, checkout expiry.
4. Update/create booking records accordingly.
5. Email update is attempted.

---

## 5.9 Hostel Booking Sub-Flow

Process:

1. Creator selects stay dates and room.
2. Booking is created with pending/confirmed states.
3. Payment confirmation updates booking lifecycle.
4. Booking links back to gate pass.

---

## 5.10 Early Check-In Request Flow

Process:

1. Creator requests early check-in.
2. Admin/guard reviews.
3. System marks request approved/rejected and records reviewer/timestamps.

---

## 5.11 Room Cancellation Request Flow

Process:

1. Creator requests room cancellation.
2. Admin reviews request.
3. On approval:
- booking status updated
- refund slab applied (if eligible)
- refund transaction recorded
4. On rejection:
- rejection reason stored

---

## 5.12 Analytics/Admin Flow

Admin gets:

- pass volume/status trends
- entry/exit data
- extension and refund insights
- guard activity snapshots

---

## 6. Permissions Summary (Practical View)

- Create pass: all authenticated roles (module policy based)
- Verify/allow/deny/exit/checkout: guard/admin
- Analytics: admin-level
- Cancel/extend: creator/admin and context-based guard permissions

Both backend middleware and frontend permission utils participate.


