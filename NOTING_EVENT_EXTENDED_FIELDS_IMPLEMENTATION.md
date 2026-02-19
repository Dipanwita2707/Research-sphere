# Noting → Event Extended Fields Implementation

## Overview
Extended the Noting-to-Event flow so that additional structured fields from Noting auto-populate in Event Creation.

## Completed Changes

### 1. Database Schema (Prisma)

**Note model** – new fields:
- `eventParticipationType` (ParticipationType) – individual/team
- `eventRegistrationFeeIndividual` (Float) – fee per person when paid + individual
- `eventRegistrationFeeTeam` (Float) – fee per team when paid + team
- `eventApproxCapacity` (Int) – informational only
- `eventDutyLeaveAvailable` (Boolean)
- `eventDutyLeaveEligibility` (Json) – array: students, faculty_teaching, faculty_non_teaching, staff
- `eventHasSponsorship` (Boolean)
- `eventSponsors` (Json) – array of {name, amount, type: cash|in_kind, notes}
- `eventHasResources` (Boolean)
- `eventResources` (Json) – array of {category: internal|external, type, description, estimatedCost?}

**Event model** – new fields:
- `approxCapacity` (Int)
- `teamRegistrationFee` (Float)
- `dutyLeaveAvailable` (Boolean)
- `dutyLeaveEligibility` (Json)
- `hasSponsorship` (Boolean)
- `sponsors` (Json)
- `hasResources` (Boolean)
- `resources` (Json)

### 2. Migration
Run: `npx prisma migrate deploy` (or `prisma migrate dev`)

Migration file: `prisma/migrations/20260213000000_add_noting_event_extended_fields/migration.sql`

### 3. Backend

**noting.controller.js**
- Create & update accept new event fields
- Validation: paid events require fee (individual or team based on participationType)

**event.service.js – createEventFromNoting**
- Maps all new fields from Note to Event
- Sets `participationType`, `registrationFee`, `teamRegistrationFee`, `approxCapacity`, `dutyLeaveAvailable`, `dutyLeaveEligibility`, `hasSponsorship`, `sponsors`, `hasResources`, `resources`

**event.service.js – updateEvent**
- `participationType` added to locked fields (from noting)

## Remaining Frontend Work

### Noting Form (`/noting/new`)
Add to Event Details section when `isEventNoting`:

1. **Participation Type**: Individual / Team (radio)
2. **Fee** (when Paid):
   - Individual → "Participation Fee (₹)" number input
   - Team → "Fee per Team (₹)" number input
3. **Approximate Capacity**: number input (optional)
4. **Duty Leave Available**: Yes / No
   - If Yes → multi-select: Students, Faculty (Teaching), Faculty (Non-Teaching), Staff
5. **Is there sponsorship?**: Yes / No
   - If Yes → repeatable: Sponsor Name, Amount (₹), Type (Cash/In-kind), Notes
6. **Are resources required?**: Yes / No
   - If Yes → repeatable: Category (Internal/External), Type, Description, Est. Cost (optional)

### Event Manage Form (`/events/[id]/manage`)
- Load and display: `approxCapacity`, `dutyLeaveAvailable`, `dutyLeaveEligibility`, `hasSponsorship`, `sponsors`, `hasResources`, `resources`, `teamRegistrationFee`
- Locked from noting: name, eventType, startDate, endDate, paymentType, participationType
- Editable: venue, registrationFee, approxCapacity, duty leave, sponsors, resources, etc.

### Payload Updates
Ensure `eventPayload` in noting/new/page.tsx includes all new fields when calling create/update.

## JSON Structures

**eventDutyLeaveEligibility**: `["students", "faculty_teaching", "faculty_non_teaching", "staff"]`

**eventSponsors**: 
```json
[
  {"name": "Sponsor A", "amount": 50000, "type": "cash", "notes": "Optional"},
  {"name": "Sponsor B", "amount": 0, "type": "in_kind", "notes": "Laptops for 5 participants"}
]
```
- **Cash**: `amount` (₹) required, `notes` optional
- **In-kind**: `notes` holds description (e.g. "Laptops", "Food for 50"), `amount` is 0

**eventResources**:
```json
[
  {"category": "internal", "type": "auditorium", "description": "Main hall", "estimatedCost": null},
  {"category": "external", "type": "travel", "description": "Guest speaker travel", "estimatedCost": 10000}
]
```

## Locked vs Editable (Event Form)
| Field | From Noting | Editable in Event |
|-------|-------------|-------------------|
| name, eventType, startDate, endDate, paymentType, participationType | Yes | No (locked) |
| registrationFee, teamRegistrationFee | Yes | Yes |
| approxCapacity, dutyLeave*, sponsors, resources | Yes | Yes |
