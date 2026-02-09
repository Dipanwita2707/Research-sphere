# Event Management System - Redesigned Structure

## 🎯 Design Goals

1. **Crystal Clear Navigation** - Users should instantly understand what each page does
2. **Role-Based Context** - Separate "attendee view" from "organizer view"
3. **Real-World Patterns** - Follow familiar event platform conventions (Eventbrite, Meetup, etc.)
4. **Zero Ambiguity** - No confusion about where to find events, create events, or manage registrations

---

## 📋 System Overview

### Event Creation Flow
```
Student/Faculty → Create Noting (Event Category) → Approval Chain 
→ Auto-Create DRAFT Event → Creator Adds Details → PUBLISH 
→ Event Visible to All → Users Register
```

**Key Principle**: Events can **ONLY** be created via approved noting requests. There is no "Create Event" button.

---

## 🗂️ Navigation Structure

### Sidebar Navigation
```
📅 Event Management
   ├── 🌐 Browse Events         (Public catalog - all published events)
   ├── 📝 My Created Events     (Events I organized - drafts + published)
   └── 🎫 My Registrations      (Events I registered for)
```

### Page-by-Page Breakdown

---

## 1️⃣ Browse Events
**Route**: `/events` or `/events/browse`  
**Audience**: All users (Student, Faculty, Admin)  
**Purpose**: Discover and register for published events

### What Users See:
- **All published events** across the university
- Events in status: `published`, `ongoing`, `completed`
- **NOT** shown: `draft` or `cancelled` events

### Features:
- ✅ Search by event name
- ✅ Filter by: Event Type, Date Range, Department, Free/Paid
- ✅ Sort by: Upcoming, Popular, Recently Added
- ✅ Event Cards show:
  - Event name & type
  - Date, time, venue
  - Registration status (Open/Closed/Waitlist)
  - Seats available
  - "Register" button (if eligible)
  - "View Details" link

### Actions Available:
- **Register for Event** - Opens registration modal with QR code generation
- **View Event Details** - Navigate to event detail page
- **Share Event** - Copy link or share on social media

### Header:
```
Browse Events
Discover and join university events - workshops, seminars, competitions, and more
```

---

## 2️⃣ My Created Events
**Route**: `/events/my-events` or `/events/created`  
**Audience**: Users who created events via noting approval  
**Purpose**: Manage events I organized

### What Users See:
- **Only events created by the logged-in user**
- Events in ALL statuses: `draft`, `published`, `ongoing`, `completed`, `cancelled`
- Tabs:
  - **Drafts** (needs completion before publishing)
  - **Published** (live and accepting registrations)
  - **Past Events** (completed/cancelled)

### Features:
- ✅ Status badges clearly visible:
  - 🟢 **Draft** - "Complete Details & Publish"
  - 🔵 **Published** - Registration count, live stats
  - ⚫ **Completed** - Final attendance, feedback summary
- ✅ Quick actions on each card:
  - ✏️ Edit Event (for drafts)
  - 📊 View Statistics
  - 👥 Manage Volunteers
  - 📋 View Registrations
  - 🚀 Publish Event (for drafts)
  - ❌ Cancel Event (for published)

### Draft Event Requirements:
Draft events show a **checklist** of required fields before publishing:
- ✅ Event Name (from noting)
- ✅ Event Type (from noting)
- ✅ Start/End Date (from noting)
- ⚠️ **Venue** (required before publish)
- ⚠️ **Registration Start Date** (required before publish)
- ⚠️ **Registration End Date** (required before publish)
- ⚠️ Max Capacity (optional but recommended)

### Header:
```
My Created Events
Events you organized through approved noting requests
```

### Information Box (shown if no events):
```
📝 How to Create an Event?
Events are created automatically when your noting request (with event category) 
is approved by the authorities. They start as DRAFTS - add venue and registration 
details to publish and open for registrations.
```

---

## 3️⃣ My Registrations
**Route**: `/events/registrations`  
**Audience**: All users who registered for events  
**Purpose**: Track events I'm attending

### What Users See:
- **All events the user registered for**
- Registration status: `pending`, `confirmed`, `waitlisted`, `cancelled`
- Tabs:
  - **Upcoming** (events not yet started)
  - **Past** (events completed)

### Features:
- ✅ QR Code display for confirmed registrations
- ✅ Download QR code (for event entry)
- ✅ Registration status badges
- ✅ Event countdown timer for upcoming events
- ✅ "Add to Calendar" button
- ✅ Cancel registration (before event starts)

### Each Registration Card Shows:
- Event name, date, venue
- Registration status
- QR code (for confirmed registrations)
- Seat number (if assigned)
- Event organizer contact

### Header:
```
My Registrations
Events you're registered to attend
```

---

## 4️⃣ Event Detail Page
**Route**: `/events/[eventId]`  
**Audience**: All users  
**Purpose**: View complete event information + Register OR Manage (based on role)

### Two Views:

#### A) Public View (for non-creators):
Shows:
- Event banner image (if any)
- Event name, type, dates
- Venue with map (if integrated)
- Description
- Organizer information
- Registration deadline
- Seats available
- Price (if paid event)
- FAQ section
- **Register Button** (prominent, sticky)

#### B) Creator/Management View (for event creators):
All public info PLUS:
- **Management Tabs**:
  1. **Overview** - Event details, edit options
  2. **Registrations** - List of registered users, export to CSV
  3. **Volunteers** - Assign and manage volunteers
  4. **Statistics** - Registration trends, attendance analytics
  5. **Settings** - Edit event, cancel event, manage QR validation

Actions for Creator:
- 🚀 **Publish Event** (if draft)
- ✏️ **Edit Event Details**
- 📊 **View Analytics**
- 👥 **Manage Registrations** (approve/reject/waitlist)
- 📲 **Scan QR Codes** (for event entry)
- 📧 **Send Announcements** (to registered users)
- ❌ **Cancel Event** (with notification to attendees)

---

## 🎨 Visual Design Patterns

### Status Badges:
| Status | Color | Icon | Meaning |
|--------|-------|------|---------|
| Draft | Gray | ⚪ | Needs completion before going live |
| Published | Blue | 🔵 | Live and accepting registrations |
| Ongoing | Green | 🟢 | Event is currently happening |
| Completed | Dark Gray | ⚫ | Event finished successfully |
| Cancelled | Red | 🔴 | Event was cancelled |

### Registration Status Badges:
| Status | Color | Icon | Meaning |
|--------|-------|------|---------|
| Pending | Yellow | ⏳ | Awaiting confirmation |
| Confirmed | Green | ✅ | Registration confirmed |
| Waitlisted | Orange | ⏱️ | On waiting list |
| Cancelled | Red | ❌ | Registration cancelled |

---

## 🔍 Search & Filter Logic

### Browse Events (Public Catalog):
**Default View**: Show only `published` and `ongoing` events  
**Filters**:
- Event Type: Workshop, Seminar, Conference, Competition, Cultural, Sports, etc.
- Date Range: This Week, This Month, Custom Range
- Department: Central, School-specific
- Payment: Free, Paid, All
- Status: Upcoming (default), Ongoing, Past

### My Created Events (Organizer Dashboard):
**Default View**: Show all user's events across all statuses  
**Tabs**: Drafts, Live, Past  
**Sort**: Newest First, Event Date, Name

### My Registrations (Attendee View):
**Default View**: Show upcoming confirmed registrations  
**Tabs**: Upcoming, Past  
**Filter**: Registration Status (Confirmed, Pending, Waitlisted)

---

## 🚀 User Flows

### Flow 1: Student Wants to Attend a Workshop
```
1. Click "Browse Events" in sidebar
2. Filter by Type: Workshop
3. See available workshops with registration counts
4. Click "Register" on desired event
5. Fill registration form → Get QR code
6. QR code sent to email + visible in "My Registrations"
7. Attend event → Scan QR at entry
```

### Flow 2: Faculty Organizes a Seminar
```
1. Create noting request (category: Events, subcategory: Events)
2. Fill event details: name, type, dates, description
3. Submit noting → Goes through approval chain
4. Noting approved → Event auto-created as DRAFT
5. Faculty sees notification: "Event created! Complete details to publish."
6. Navigate to "My Created Events" → See draft event
7. Click "Complete & Publish" → Add venue, registration dates, capacity
8. Click "Publish Event" → Event goes live in "Browse Events"
9. Students start registering → Track in "Registrations" tab
10. On event day → Use "Scan QR" feature to mark attendance
11. Post-event → View statistics, attendance reports
```

### Flow 3: User Checks Their Event Status
```
As Organizer:
- Go to "My Created Events" → See all events I organized, manage drafts, view stats

As Attendee:
- Go to "My Registrations" → See QR codes, event details, upcoming events
```

---

## 🔐 Permissions & Visibility

| Action | Student | Faculty | Admin | Super Admin |
|--------|---------|---------|-------|-------------|
| Browse all published events | ✅ | ✅ | ✅ | ✅ |
| Register for events | ✅ | ✅ | ✅ | ✅ |
| Create events (via noting) | ❌ | ✅ | ✅ | ✅ |
| View own draft events | ❌ | ✅ | ✅ | ✅ |
| Publish own events | ❌ | ✅ | ✅ | ✅ |
| View all events (including drafts) | ❌ | ❌ | ✅ | ✅ |
| Cancel any event | ❌ | ❌ | ✅ | ✅ |
| View all registrations | ❌ | ❌ | ✅ | ✅ |

**Note:** Students are completely removed from the Noting system. Only Faculty, Staff, and Admin roles can create, forward, approve, or reject notings.

---

## 📊 Dashboard Metrics (Per Page)

### Browse Events:
- Total published events
- Events happening this week
- Most popular events

### My Created Events:
- Total events created
- Draft events (needs action)
- Total registrations across all events
- Upcoming events requiring management

### My Registrations:
- Upcoming registrations count
- Next event countdown
- QR codes ready for use

---

## 🎯 Key Improvements Summary

### Before (Confusing):
- ❌ "All Events" tab mixed public + creator's events
- ❌ "My Events" unclear meaning
- ❌ Drafts shown alongside published events
- ❌ No clear call-to-action for draft completion
- ❌ Users confused about event creation process

### After (Clear):
- ✅ **Browse Events** = Public catalog (attendee mindset)
- ✅ **My Created Events** = Organizer dashboard (presenter mindset)
- ✅ **My Registrations** = Attendee tracking (my tickets)
- ✅ Clear draft → publish workflow with checklists
- ✅ Prominent info: "Events created via approved notings"

---

## 🛠️ Implementation Checklist

### Phase 1: Navigation & Routing
- [ ] Update sidebar navigation items
- [ ] Rename routes: `/events` → Browse, `/events/my-events` → Created, `/events/registrations` → Registrations
- [ ] Update breadcrumbs and page headers

### Phase 2: Backend API Updates
- [ ] Add `creatorView` parameter to event listing API
- [ ] Separate endpoints: `/events/browse` vs `/events/my-created`
- [ ] Update visibility logic for draft events

### Phase 3: Frontend UI Redesign
- [ ] Redesign Browse Events page (public catalog style)
- [ ] Create My Created Events page (management dashboard style)
- [ ] Update My Registrations page (ticket-style cards with QR)
- [ ] Add draft completion checklist UI
- [ ] Add "How to Create Events" info box

### Phase 4: Event Detail Page
- [ ] Implement dual view (public vs creator)
- [ ] Add management tabs for creators
- [ ] Add prominent "Register" CTA for public view
- [ ] Add QR scan functionality for event day

### Phase 5: Polish & UX
- [ ] Add loading skeletons
- [ ] Add empty states with helpful guidance
- [ ] Add tooltips explaining draft vs published
- [ ] Add success/error notifications for all actions
- [ ] Mobile responsive design

---

## 📝 Naming Conventions (Final)

| Current Name | New Name | Route | Purpose |
|--------------|----------|-------|---------|
| Events | Browse Events | `/events` | Public event catalog |
| My Events (tab) | My Created Events | `/events/my-events` | Events I organized |
| My Registrations | My Registrations | `/events/registrations` | Events I'm attending |

---

## 🎓 User Education

### On Browse Events Page:
> **Looking to organize an event?**  
> Create a noting request with event details through the Noting System. Once approved, your event will appear in "My Created Events" as a draft. Complete the details and publish to make it live!

### On My Created Events (Empty State):
> **No events yet?**  
> Events are automatically created when your noting requests (with event category) are approved. Once created, they'll appear here in draft status for you to complete and publish.

### On Event Detail (Draft):
> **⚠️ This is a draft event**  
> Complete the checklist below and publish to make this event visible to all users for registration.

---

## ✅ Success Metrics

After implementation, users should be able to answer:
1. ✅ "Where do I find events to register for?" → **Browse Events**
2. ✅ "Where do I manage events I'm organizing?" → **My Created Events**
3. ✅ "Where are my event tickets/QR codes?" → **My Registrations**
4. ✅ "How do I create an event?" → **Via approved noting request**
5. ✅ "Why is my event not visible to others?" → **It's in draft, complete & publish**

---

**End of Redesign Document**
