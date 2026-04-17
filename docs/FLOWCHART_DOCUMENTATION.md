# SGT University Management System - Flowchart Documentation

## Overview

This document provides detailed flowcharts for all modules of the SGT-UMS system, designed to help testers understand the complete system workflow.

---

## 📁 Flowchart Files

| Flowchart | File | Description | Size |
|-----------|------|-------------|------|
| **Noting Module** | `Flowchart_Noting_Module.png` | Complete noting workflow with approval chain | ~510 KB |
| **DSW Module** | `Flowchart_DSW_Module.png` | Club management lifecycle | ~397 KB |
| **Event Module** | `Flowchart_Event_Module.png` | Complete event lifecycle | ~654 KB |
| **Combined System** | `Flowchart_Combined_System.png` | Inter-module integration | ~461 KB |

---

## 📝 1. NOTING MODULE FLOWCHART

### Purpose
Shows the complete noting workflow from draft creation through approval to auto-entity creation.

### Key Processes

| Step | Process | Description |
|------|---------|-------------|
| 1 | **Authentication** | User login and permission check (`noting_create`) |
| 2 | **Category Selection** | Academic or Administrative category |
| 3 | **Subcategory Selection** | Events, DSW, Curriculum, Exam, etc. |
| 4 | **Event Noting** | Fill event details (name, type, dates, fees, sponsors) |
| 5 | **Club Noting** | Fill club details (name, category, facilitator, chairperson) |
| 6 | **Draft Management** | Save draft, edit, or submit |
| 7 | **Submission** | Validate fields, submit to PENDING status |
| 8 | **Auto-Forward** | System finds reporting manager and auto-forwards |
| 9 | **Approval Workflow** | Approver actions: Approve/Reject/Forward/Recommend/Revert |
| 10 | **Auto-Create Entity** | On approval: Create Event or Club record automatically |
| 11 | **Copy Distribution** | Send approved note copies to recipients |

### Decision Points

| Decision | Condition | Paths |
|----------|-----------|-------|
| Is Event Noting? | `subcategory === 'events'` | Yes → Event Form, No → Check Club |
| Is Club Creation? | `subcategory === 'dsw_club_creation'` | Yes → Club Form, No → Other Form |
| Event Type? | `notingEventType` | Venue / Stall / Festival |
| Has Sponsorship? | `eventHasSponsorship` | Yes → Add Sponsors |
| Approver Action? | User choice | Approve / Forward / Recommend / Reject / Revert |
| Final Approver? | End of approval chain | Yes → Approved, No → Forward |

### Status Transitions
```
DRAFT → PENDING → APPROVED / REJECTED / REVERTED
```

### Test Scenarios
- [ ] Create event noting with all fields
- [ ] Create club creation noting
- [ ] Submit and verify auto-forward to manager
- [ ] Approve note and verify event auto-creation
- [ ] Reject note with reason
- [ ] Forward note to different user
- [ ] Revert note to draft for revision
- [ ] Send copies post-approval

---

## 🏛️ 2. DSW MODULE FLOWCHART

### Purpose
Shows the complete club management lifecycle including creation, member management, and applications.

### Key Processes by Role

#### Admin Flow
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Category Management** | Create/Update/Deactivate club categories |
| 2 | **View Statistics** | Dashboard with club counts by category, status, session |

#### Faculty Flow
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Create Club via Noting** | Fill club form → Submit to Noting → Wait for approval |
| 2 | **Club Auto-Created** | On noting approval, club record is created |
| 3 | **Manage Club** | Update editable fields (email, social media, strength) |
| 4 | **Member Management** | Add/Remove members, Update roles |
| 5 | **Application Review** | Review and approve/reject student applications |
| 6 | **View Audit Logs** | Track all club-related actions |

#### Student Flow
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Browse Clubs** | View clubs with filters (category, status, search) |
| 2 | **Apply to Join** | Submit application with details |
| 3 | **View My Applications** | Check application status |
| 4 | **View My Clubs** | See club memberships |
| 5 | **Request Club Creation** | Students can propose new clubs |

#### Chairperson Flow
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Manage Members** | Add/remove/update club members |
| 2 | **Review Applications** | Approve/reject join requests |
| 3 | **Update Club Info** | Edit permitted fields |

### Member Roles
```
Chair → Vice Chair → Secretary → Treasurer → Core Member →
Tech Lead → Creative Lead → PR Lead → Volunteer
```

### Field Types
| Type | Fields | Edit Method |
|------|--------|-------------|
| **Editable** | Email, Social Media, Student Strength | Direct edit |
| **Immutable** | Name, Category, Purpose, Facilitator, Chairperson | Requires new Noting |

### Test Scenarios
- [ ] Admin creates new category
- [ ] Faculty creates club via noting
- [ ] Club auto-created on approval
- [ ] Faculty adds member with specific role
- [ ] Faculty removes member (soft delete)
- [ ] Student applies to join club
- [ ] Faculty reviews and approves application
- [ ] Chairperson manages members
- [ ] View audit logs for club actions

---

## 🎪 3. EVENT MODULE FLOWCHART

### Purpose
Shows the complete event lifecycle from creation through registration to post-event activities.

### Key Processes

#### Event Creation (From Noting)
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Event Auto-Created** | From approved noting (DRAFT status) |
| 2 | **Configure Visibility** | All / Role-based / Student filters |
| 3 | **Registration Settings** | Auto/Manual approve, Team settings |
| 4 | **Custom Fields** | Add form fields with validation |
| 5 | **Payment Config** | Free or Paid (set fee) |
| 6 | **Coupon Setup** | Create discount codes |
| 7 | **Prize Config** | Define prizes (cash, certificate, etc.) |
| 8 | **Certificate Template** | Upload and configure template |
| 9 | **Stall Config** | For festivals: student/creator stalls |
| 10 | **Assign Volunteers** | Select users, set QR scan permissions |
| 11 | **Publish Event** | Validate and go live |

#### Student Registration Flow
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Browse Events** | View visible events with filters |
| 2 | **Check Eligibility** | Visibility rules, capacity check |
| 3 | **Team Management** | Create team / Join team / Accept invite |
| 4 | **Fill Form** | Custom registration form |
| 5 | **Apply Coupon** | Validate and apply discount |
| 6 | **Payment** | Razorpay checkout (if paid event) |
| 7 | **Generate QR** | QR code ticket generated |
| 8 | **Confirmation** | Email sent, ticket displayed |

#### Volunteer Flow (QR Scanning)
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Scan QR Code** | Decode and validate |
| 2 | **Check Registration** | Verify confirmed status |
| 3 | **Entry/Exit** | Mark entry or exit |
| 4 | **Log Attendance** | Record in database |

#### Post-Event Flow
| Step | Process | Description |
|------|---------|-------------|
| 1 | **Feedback** | Collect 10-point ratings + comments |
| 2 | **Certificates** | Generate PDFs, upload to S3, email |
| 3 | **Analytics** | View registration, attendance, revenue stats |
| 4 | **Bulk Email** | Send targeted emails with tracking |

### Event Status Lifecycle
```
DRAFT → PUBLISHED → ONGOING → COMPLETED / CANCELLED
```

### Registration Status Lifecycle
```
PENDING → CONFIRMED / REJECTED / WAITLISTED / CANCELLED
```

### Team Status Lifecycle
```
FORMING → COMPLETE → CONFIRMED → DISQUALIFIED / WITHDRAWN
```

### Test Scenarios
- [ ] Configure event visibility (role-based, student filter)
- [ ] Add custom registration fields
- [ ] Create coupon and verify discount
- [ ] Student registers for free event
- [ ] Student registers for paid event (payment flow)
- [ ] Team creation and join request flow
- [ ] Volunteer scans QR for entry
- [ ] Volunteer scans QR for exit
- [ ] Generate certificate for attendee
- [ ] Send bulk email to registered users
- [ ] View event analytics

---

## 🔗 4. COMBINED SYSTEM FLOWCHART

### Purpose
Shows how all three modules interconnect and depend on each other.

### Module Integration Points

#### Noting → Event Management
```
Approved Event Noting → Auto-Create Event Record (Draft) → Configure → Publish
```

#### Noting → DSW
```
Approved Club Noting → Auto-Create Club Record → Manage Members
```

#### DSW → Event Management
```
Club Created → Club can create linked Events
Club Members → Can be assigned as Event Volunteers
```

### Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ENTERS SYSTEM                        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    AUTHENTICATION     │
                    └──────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   NOTING    │     │     DSW     │     │    EVENT    │
    │   MODULE    │     │   MODULE    │     │   MODULE    │
    └─────────────┘     └─────────────┘     └─────────────┘
           │                   ▲                   ▲
           │                   │                   │
           ├───────────────────┘                   │
           │   (Club Auto-Created)                 │
           │                                       │
           └───────────────────────────────────────┘
               (Event Auto-Created)
```

### External Services Integration

| Service | Module | Purpose |
|---------|--------|---------|
| **Razorpay** | Event | Payment processing |
| **SendGrid** | Noting, Event | Email notifications |
| **AWS S3** | Event | Certificate storage |
| **Redis** | All | Caching |

### Database Tables by Module

| Module | Primary Tables |
|--------|---------------|
| **Noting** | `note`, `note_history`, `note_copy`, `note_attachment` |
| **DSW** | `club`, `club_member`, `club_category`, `club_audit_log` |
| **Event** | `event`, `event_registration`, `event_team`, `event_volunteer`, `event_entry` |

---

## 🔣 Flowchart Symbol Legend

| Symbol | Meaning | Example |
|--------|---------|---------|
| 🟢 Rounded Rectangle | Start/End | `START`, `END - Success` |
| 🔵 Rectangle | Process | `Fill Form`, `Save Draft` |
| 🟡 Diamond | Decision | `Is Event?`, `Approved?` |
| 🟣 Cylinder | Data Store | `Database`, `Redis Cache` |
| 🔴 Rectangle (Red) | Error/Rejection | `Access Denied`, `Rejected` |
| 🔷 Parallelogram | Subprocess | `Noting Approval Workflow` |

### Color Coding

| Color | Module/Type |
|-------|-------------|
| **Blue** | Noting Module / General Process |
| **Purple** | DSW Module |
| **Yellow/Orange** | Event Module / Decisions |
| **Green** | Success States / Data Stores |
| **Red** | Error States / Rejections |
| **Pink** | External Services |

---

## 📋 Testing Checklist

### End-to-End Flows to Test

#### Flow 1: Event Creation → Registration → Attendance
```
1. Faculty creates Event Noting
2. DSW approves Noting
3. Event auto-created (Draft)
4. Faculty configures Event
5. Faculty publishes Event
6. Student browses and registers
7. Student completes payment
8. Student receives QR ticket
9. Volunteer scans QR at entry
10. Student attends event
11. Volunteer scans QR at exit
12. Student submits feedback
13. Faculty generates certificates
```

#### Flow 2: Club Creation → Member Management
```
1. Faculty creates Club Noting
2. DSW approves Noting
3. Club auto-created
4. Faculty adds initial members
5. Student applies to join
6. Faculty reviews application
7. Student becomes member
8. Audit log records all actions
```

#### Flow 3: Noting Rejection → Revision → Re-approval
```
1. Faculty creates Noting
2. Approver rejects with reason
3. Faculty revises draft
4. Faculty resubmits
5. Approver approves
```

---

## 📂 File Structure

```
docs/
├── Flowchart_Noting_Module.mmd      # Mermaid source
├── Flowchart_Noting_Module.png      # PNG image
├── Flowchart_DSW_Module.mmd         # Mermaid source
├── Flowchart_DSW_Module.png         # PNG image
├── Flowchart_Event_Module.mmd       # Mermaid source
├── Flowchart_Event_Module.png       # PNG image
├── Flowchart_Combined_System.mmd    # Mermaid source
├── Flowchart_Combined_System.png    # PNG image
└── FLOWCHART_DOCUMENTATION.md       # This file
```

---

*Generated: April 3, 2026*
*System: SGT University Management System (UMS)*
