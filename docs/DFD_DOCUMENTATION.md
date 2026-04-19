# SGT University Management System - Data Flow Diagrams

## System Overview

This document contains Data Flow Diagrams (DFDs) for the SGT University Management System (UMS), covering three major modules:

1. **Noting Module** - Approval workflow system
2. **DSW Module** - Dean of Students' Welfare (Club Management)
3. **Event Management Module** - Complete event lifecycle management

---

## Level 0: Context Diagram

**File:** `dfd-level0-context.png`

### Description
The Context Diagram shows the entire SGT-UMS as a single process, illustrating all external entities that interact with the system and the primary data flows between them.

### External Entities

| Entity | Role | Primary Interactions |
|--------|------|---------------------|
| **Student** | University student | Register for events, join clubs/teams, submit feedback, view certificates |
| **Faculty** | Teaching staff | Create noting requests, manage events/clubs, assign volunteers |
| **Staff** | Administrative staff | Process notings, manage events |
| **Admin/Superadmin** | System administrator | System configuration, analytics, override controls |
| **DSW Office** | Dean of Students' Welfare | Approve/reject notings, manage club categories |
| **Volunteer** | Event staff | QR code scanning, entry/exit recording |
| **Public User** | External user | Certificate verification |

### Data Stores

| Store | Technology | Purpose |
|-------|------------|---------|
| **PostgreSQL Database** | Prisma ORM | Primary data storage for all entities |
| **Redis Cache** | In-memory | Performance caching (stats, sessions, config) |
| **AWS S3** | Cloud storage | Certificates, templates, file uploads |
| **Razorpay** | Payment gateway | Event payment processing |
| **SendGrid** | Email service | Notifications, bulk emails |

---

## Level 1: Detailed Module Breakdown

**File:** `dfd-level1-detailed.png`

### 1.0 NOTING MODULE

The Noting module handles the approval workflow for academic and administrative requests.

#### Processes

| Process | Name | Description |
|---------|------|-------------|
| **1.1** | Create Noting | Faculty/students create draft notes for events, clubs, etc. |
| **1.2** | Submit Noting | Draft is submitted, moves to PENDING status |
| **1.3** | Approval Workflow | Approvers review, approve, or forward notes through hierarchy |
| **1.4** | Forward/Reject | Forward to another approver or reject with reason |
| **1.5** | Copy Distribution | Send approved note copies to stakeholders |
| **1.6** | Auto-Create Entity | On approval, auto-create Event or Club records |

#### Data Flows
```
Faculty → [Note Request] → 1.1 Create Noting
1.1 → [Draft Note] → D1: Note Store
1.2 → [Pending Note] → 1.3 Approval Workflow
1.3 → [Approved] → 1.6 Auto-Create Entity
1.6 → [Event/Club Created] → D3/D2 Stores
```

#### Status Lifecycle
```
DRAFT → PENDING → APPROVED/REJECTED/REVERTED
```

---

### 2.0 DSW MODULE

The DSW (Dean of Students' Welfare) module manages student clubs and organizations.

#### Processes

| Process | Name | Description |
|---------|------|-------------|
| **2.1** | Category Management | Admin creates/manages club categories (Cultural, Technical, Sports, etc.) |
| **2.2** | Club Creation | Create club record from approved noting |
| **2.3** | Member Management | Add/remove/update club members with roles |
| **2.4** | Application Review | Review student applications to join clubs |
| **2.5** | Audit Logging | Track all club-related actions |
| **2.6** | Statistics Dashboard | View club statistics and analytics |

#### Data Flows
```
Noting Module → [Approved Club] → 2.2 Club Creation
Student → [Join Request] → 2.4 Application Review
Faculty → [Add Member] → 2.3 Member Management
2.5 → [Audit Entry] → D2: Club Store
```

#### Member Roles
- Chair, Vice Chair, Secretary, Treasurer, Core Member, Tech Lead, Creative Lead, PR Lead, Volunteer

---

### 3.0 EVENT MANAGEMENT MODULE

The Event Management module handles the complete event lifecycle from creation to post-event activities.

#### Processes

| Process | Name | Description |
|---------|------|-------------|
| **3.1** | Event Discovery | Browse/search published events with filters |
| **3.2** | Event Registration | Individual event registration with form submission |
| **3.3** | Team Management | Create/join teams for team-based events |
| **3.4** | Payment Processing | Razorpay integration for paid events |
| **3.5** | QR Scan Attendance | Entry/exit scanning at venue |
| **3.6** | Volunteer Management | Assign volunteers with scan permissions |
| **3.7** | Certificate Generation | Generate and distribute PDF certificates |
| **3.8** | Feedback Collection | Post-event feedback with 10-point ratings |
| **3.9** | Stall Management | Student stall applications for festivals |
| **3.10** | Bulk Email System | Send targeted emails with tracking |
| **3.11** | Analytics Dashboard | Event statistics and reports |

#### Data Flows
```
Student → [Browse] → 3.1 Event Discovery → D3: Event Store
Student → [Register] → 3.2 Registration → [QR Code] → Student
3.2 → [Payment Required] → 3.4 Payment → Razorpay
Volunteer → [Scan QR] → 3.5 Attendance → D3: Event Store
Faculty → [Generate] → 3.7 Certificates → S3 Storage
```

#### Event Status Lifecycle
```
DRAFT → PUBLISHED → ONGOING → COMPLETED/CANCELLED
```

#### Registration Status Lifecycle
```
PENDING → CONFIRMED/REJECTED/WAITLISTED/CANCELLED
```

---

## Cross-Module Integration

### Noting → Event Management
- Approved event notings automatically create Event records
- Event configuration (visibility, fees, team settings) inherited from noting

### Noting → DSW
- Approved club-creation notings automatically create Club records
- Club metadata (facilitator, chairperson, members) derived from noting

### DSW → Event Management
- Clubs can have linked events
- Club members can be auto-assigned as volunteers

---

## Data Store Reference

### D1: Note Database
- `note` - Core noting records
- `note_history` - Workflow audit trail
- `note_copy` - Post-approval copy distribution
- `note_attachment` - Supporting files

### D2: Club Database
- `club` - Club records
- `club_member` - Membership with roles
- `club_category` - Club categories
- `club_audit_log` - Activity logs

### D3: Event Database
- `event` - Event records
- `event_registration` - User registrations with QR codes
- `event_team` - Team records
- `event_volunteer` - Volunteer assignments
- `event_entry` - Attendance logs

### D4: User Database
- `user_login` - Authentication
- `employee_details` - Faculty/staff profiles
- `student_login` - Student profiles

### D5: Payment Database
- `payment` - Razorpay transactions
- `event_coupon` - Discount codes
- `coupon_usage` - Coupon redemptions

### D6: Certificate Database
- `event_certificate_template` - Certificate designs
- `event_certificate_log` - Generated certificates

### D7: Redis Cache
- Session data
- Permission caches
- Statistics caches
- Event visibility caches

### D8: AWS S3
- Certificate PDFs
- Template images
- File uploads

---

## Permission Matrix

| Permission Key | Description | Roles |
|----------------|-------------|-------|
| `noting_create` | Create/edit drafts | Faculty |
| `noting_approve` | Approve notings | Approvers, DSW |
| `dsw_manage_members` | Manage club members | Faculty, Chairperson |
| `event_manage_own` | Manage own events | Event creators |
| `event_manage_all` | Manage all events | Admin |
| `event_manage_attendance` | QR scanning | Volunteers |

---

## Files Generated

### High-Quality Images (PNG)

| File | Description | Recommended Use |
|------|-------------|-----------------|
| `DFD_Level0_Context.png` | **Context Diagram** - System overview with all external entities | Executive summary, high-level testing overview |
| `DFD_Level1_Noting.png` | **Noting Module DFD** - Approval workflow processes | Testing noting creation, approval flows |
| `DFD_Level1_DSW.png` | **DSW Module DFD** - Club management processes | Testing club creation, member management |
| `DFD_Level1_Event.png` | **Event Module DFD** - Complete event lifecycle | Testing registration, payments, certificates |

### Source Files (Mermaid)

| File | Description |
|------|-------------|
| `DFD_Level0_Context.mmd` | Mermaid source for Context Diagram |
| `DFD_Level1_Noting.mmd` | Mermaid source for Noting Module |
| `DFD_Level1_DSW.mmd` | Mermaid source for DSW Module |
| `DFD_Level1_Event.mmd` | Mermaid source for Event Module |

### Legacy Files (Combined View)

| File | Description |
|------|-------------|
| `dfd-level0-context.png` | Alternative context diagram layout |
| `dfd-level1-detailed.png` | All modules in single diagram (complex view) |

---

## For Testers

### Quick Reference: End-to-End Flow

1. **Event Creation Flow:**
   ```
   Faculty creates Noting → DSW approves → Event auto-created → Students register
   ```

2. **Club Creation Flow:**
   ```
   Faculty/Student creates Noting → DSW approves → Club auto-created → Students join
   ```

3. **Event Attendance Flow:**
   ```
   Student registers → Gets QR code → Volunteer scans → Entry recorded
   ```

4. **Certificate Flow:**
   ```
   Event completed → Faculty generates certificates → Student downloads → Public verifies
   ```

### Key Testing Points

- [ ] Noting approval workflow through all statuses
- [ ] Auto-creation of events/clubs from approved notings
- [ ] Payment flow with Razorpay webhooks
- [ ] QR code generation and scanning
- [ ] Certificate generation and verification
- [ ] Permission checks at all endpoints
- [ ] Cache invalidation on data changes

---

*Generated: April 3, 2026*
*System: SGT University Management System (UMS)*
