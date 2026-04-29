# SGT University Management System
# Complete Tester Guide - Simple Language Explanation

**Purpose:** This document explains the entire system in simple words so any tester can understand and test all features just by reading this guide.

---

## TABLE OF CONTENTS

1. [What is This System?](#what-is-this-system)
2. [MODULE 1: NOTING (The Approval System)](#module-1-noting-the-approval-system)
3. [MODULE 2: DSW - Club Management](#module-2-dsw---club-management)
4. [MODULE 3: EVENT MANAGEMENT](#module-3-event-management)
5. [HOW ALL MODULES WORK TOGETHER](#how-all-modules-work-together)
6. [REAL-LIFE USAGE SCENARIOS](#real-life-usage-scenarios)
7. [COMPLETE TESTING GUIDE](#complete-testing-guide)

---

# WHAT IS THIS SYSTEM?

This is a university management system for SGT University. It helps the university manage:

1. **Approvals** (Noting) - Getting permission for events, clubs, and other activities
2. **Student Clubs** (DSW) - Creating and managing student clubs and organizations
3. **Events** (Event Management) - Organizing events, registrations, attendance, and certificates

Think of it like this:
- Want to organize a hackathon? First get **approval** (Noting) → Then **set up** the event → Students **register** → They **attend** with QR codes → They get **certificates**

---

# MODULE 1: NOTING (The Approval System)

## What is Noting?

Noting is like a **digital permission slip**. Before anyone can create an event or start a new club, they need approval from the university. The Noting system handles all these approvals.

Think of it as filling out a form, submitting it, and waiting for your boss to approve it - but everything happens on the computer.

## Who Uses Noting?

| Person | What They Can Do |
|--------|------------------|
| **Faculty/Staff** | Create requests for events, clubs, etc. |
| **DSW Office** | Approve or reject requests |
| **Admins** | View all requests, manage the system |

## Step-by-Step Flow: Creating a Noting Request

### Step 1: Login and Navigate
1. User logs into the system
2. Clicks on "Noting" in the menu
3. Sees the Noting dashboard

**What You Should See:**
- A list of your previous requests (if any)
- Buttons showing: "My Notings", "Pending for My Approval", "Handled"
- A "Create New" or "+ New Noting" button

### Step 2: Start a New Noting Request
1. Click "Create New" or "+ New Noting"
2. Select a **Category**:
   - **Academic** - For events, curriculum changes, student matters, exams
   - **Administrative** - For infrastructure, purchases, club creation

**What You Should See:**
- A form appears with category selection
- Once you select a category, subcategory options appear

### Step 3: Choose Subcategory

Depending on your category:

**For Academic:**
- Events (workshops, seminars, competitions)
- Curriculum changes
- Student-related matters
- Exam related

**For Administrative:**
- Infrastructure requests
- Accounts/Purchase requests
- Non-academic resources
- DSW Club Creation (to create a new student club)

### Step 4: Fill Out the Form

**For an Event Noting:**
1. Enter event name
2. Select event type (workshop, seminar, hackathon, etc.)
3. Enter start and end dates
4. Choose if it's free or paid
5. If paid, enter registration fees
6. Choose individual or team participation
7. Enter expected number of participants
8. Add any sponsors (if applicable)
9. Add any prizes/awards (if applicable)
10. Upload supporting documents (if needed)

**What You Should See:**
- All fields appear based on your selections
- Required fields are marked with asterisks (*)
- Date pickers for selecting dates
- Number fields for fees and capacity

### Step 5: Save as Draft or Submit

**Option A: Save as Draft**
- Click "Save as Draft"
- Your noting is saved but NOT sent for approval
- You can come back and edit it later
- Status shows: **DRAFT**

**Option B: Submit for Approval**
- Click "Submit"
- Your noting is sent to the approval chain
- Status changes to: **PENDING**
- Your manager/reporting head receives it

**What You Should See After Submitting:**
- Success message: "Noting submitted successfully"
- Status badge shows "Pending"
- You can no longer edit the noting

### Step 6: Approval Process

**When Someone Receives Your Noting:**
They see it in their "Pending for My Approval" tab.

**What the Approver Can Do:**
1. **Approve** - Accept the request → moves to next approver or final approval
2. **Reject** - Decline with a reason → back to creator
3. **Forward** - Send to another person for their opinion
4. **Recommend** - Approve with comments, send up the chain
5. **Revert** - Send back to creator for changes

### Step 7: After Final Approval

**If Approved:**
- Status changes to: **APPROVED**
- For event notings → An event is automatically created
- For club notings → A club is automatically created
- Creator receives notification

**If Rejected:**
- Status changes to: **REJECTED**
- Creator sees the rejection reason
- Can create a new noting if needed

### Step 8: Copy Distribution (After Approval)

After approval, copies can be sent to relevant people:
- Click "Send Copy"
- Select recipients
- Add remarks
- Recipients can view and reply

---

## Testing Noting: Normal Flow

| Step | What Tester Should Do | What Should Happen |
|------|----------------------|-------------------|
| 1 | Login as Faculty | Dashboard loads |
| 2 | Click "Noting" menu | Noting page opens |
| 3 | Click "Create New" | Form appears |
| 4 | Select "Academic" → "Events" | Event form fields appear |
| 5 | Fill all required fields | Fields accept input |
| 6 | Click "Submit" | Success message, status = Pending |
| 7 | Login as Approver | See the noting in "Pending" tab |
| 8 | Click "Approve" | Status changes to Approved |
| 9 | Check Events page | New event should appear |

## Testing Noting: Error Cases

| Scenario | What Tester Should Do | Expected Result |
|----------|----------------------|-----------------|
| Empty required field | Leave event name blank, click Submit | Error: "Event name is required" |
| Invalid dates | Enter end date before start date | Error: "End date must be after start date" |
| Submit without login | Try to access /noting/new directly | Redirected to login page |
| No permission | Login as student, try to create noting | Should not see "Create New" option or get "Permission denied" |
| Reject noting | Approver clicks "Reject" | Creator sees noting with "Rejected" status and reason |

---

# MODULE 2: DSW - CLUB MANAGEMENT

## What is DSW?

DSW stands for **Dean of Students' Welfare**. This module manages all student clubs at the university - cultural clubs, tech clubs, sports clubs, etc.

Think of it as a directory and management system for all student organizations.

## Who Uses DSW?

| Person | What They Can Do |
|--------|------------------|
| **Students** | Browse clubs, apply to join, view their memberships |
| **Faculty** | Create clubs (via Noting), manage club members |
| **Club Chairperson** | Manage their club, add/remove members, review applications |
| **Admin** | Manage categories, view all clubs, see statistics |

## Understanding Club Status

| Status | What It Means |
|--------|--------------|
| **Draft** | Club request saved but not submitted |
| **Pending Approval** | Waiting for DSW office to approve |
| **Approved** | DSW approved, club is official |
| **Active** | Club is active and operating |
| **Suspended** | Club temporarily stopped |
| **Archived** | Club no longer exists |

## Step-by-Step Flow: Creating a New Club

### Step 1: Start Club Creation
1. Login as Faculty or Student
2. Go to "DSW" in the menu
3. Click "Create Club" or "+ New Club"

**What You Should See:**
- A multi-step form wizard
- Progress indicator showing steps

### Step 2: Core Identity (Step 1 of Form)
1. Enter Club Name (e.g., "Coding Ninjas Club")
2. Select Category (e.g., "Technical", "Cultural", "Sports")
3. Enter Club Purpose (what the club will do)
4. Select Academic Session (e.g., "2025-2026")

**What You Should See:**
- Text fields for name and purpose
- Dropdown for category
- Session selector

### Step 3: Authority & Membership (Step 2 of Form)
1. Select Faculty Facilitator (search and select a faculty member)
2. Select Chairperson (search and select a student)
3. Optionally add Initial Members

**What You Should See:**
- Search boxes that let you find people by name or ID
- Selected people appear as chips/tags

### Step 4: Governance & Compliance (Step 3 of Form)
1. Select Target Student Group (Undergraduate, Postgraduate, PhD, or All)
2. Choose Expected Activity Types (workshops, competitions, etc.)
3. Accept Code of Conduct checkbox
4. Accept Anti-Discrimination Policy checkbox

**What You Should See:**
- Multi-select options
- Checkboxes that must be checked to proceed

### Step 5: Operational Planning (Step 4 of Form)
1. Select Meeting Frequency (monthly, quarterly, etc.)
2. Enter estimated number of activities per year

**What You Should See:**
- Dropdown for frequency
- Number input for activities

### Step 6: Optional Details (Step 5 of Form)
1. (Optional) Enter proposed club email
2. (Optional) Add social media links (Instagram, LinkedIn, etc.)
3. (Optional) Expected student strength (how many members)

### Step 7: Submit
1. Review all information
2. Click "Submit"
3. A Noting request is automatically created

**What You Should See:**
- Summary of all entered information
- "Submit" button
- After submit: "Club creation request submitted for approval"

### Step 8: Approval Process
- The noting goes through the approval workflow (as explained in Module 1)
- When approved → Club is automatically created

---

## Managing an Existing Club

### Viewing Clubs

1. Go to "DSW" → "Clubs"
2. See list of all clubs
3. Use filters: Category, Status, Search by name

**What You Should See:**
- Cards or list showing club name, category, status
- Filter dropdowns and search box
- Click on a club to view details

### Club Detail Page

Shows:
- Club name, category, purpose
- Faculty Facilitator name
- Chairperson name
- Member list
- Status badge
- Social media links

### Managing Members (Faculty/Chairperson Only)

**To Add a Member:**
1. Go to club detail page
2. Click "Add Member"
3. Search for a student
4. Select role (Member, Secretary, Treasurer, etc.)
5. Click "Add"

**To Remove a Member:**
1. Find the member in the list
2. Click "Remove" next to their name
3. Confirm removal

**Member Roles Available:**
- Chair (automatically assigned to chairperson)
- Vice Chair
- Secretary
- Treasurer
- Core Member
- Tech Lead
- Creative Lead
- PR Lead
- Volunteer

### Reviewing Applications

When students apply to join:
1. Go to club page
2. Click "Applications" tab
3. See pending applications
4. For each: Click "Approve" or "Reject"

---

## Student View: Joining a Club

### Step 1: Browse Clubs
1. Login as Student
2. Go to "DSW" → "Clubs"
3. See all active clubs

### Step 2: View Club Details
1. Click on a club
2. See club information
3. If interested, click "Apply to Join"

### Step 3: Submit Application
1. Click "Apply to Join"
2. (Optional) Add a message
3. Submit

**What You Should See:**
- Confirmation: "Application submitted"
- Application status: "Pending"

### Step 4: Check Application Status
1. Go to "My Applications"
2. See status: Pending / Approved / Rejected

---

## Testing DSW: Normal Flow

| Step | What Tester Should Do | What Should Happen |
|------|----------------------|-------------------|
| 1 | Login as Faculty | Dashboard loads |
| 2 | Go to DSW → Create Club | Multi-step form opens |
| 3 | Fill all steps | Can proceed through all steps |
| 4 | Submit | Noting created, "Submitted" message |
| 5 | Login as Admin/DSW | See noting in pending |
| 6 | Approve | Club appears in club list |
| 7 | Login as Student | Can see club in browse |
| 8 | Apply to join | Application submitted |
| 9 | Login as Faculty/Chairperson | See application in pending |
| 10 | Approve application | Student is now a member |

## Testing DSW: Error Cases

| Scenario | What Tester Should Do | Expected Result |
|----------|----------------------|-----------------|
| Duplicate club name | Create club with existing name | Error: "Club name already exists" |
| Missing required fields | Skip club name, try to proceed | Cannot proceed to next step |
| Remove chairperson | Try to remove the chairperson | Error: "Cannot remove chairperson" |
| Student creates club | Login as student, try to create | Should go through Noting process |
| Apply to closed club | Apply to archived club | Should not see "Apply" button |

---

# MODULE 3: EVENT MANAGEMENT

## What is Event Management?

This module handles everything about university events - from small workshops to big festivals. It includes:
- Creating and configuring events
- Student registrations
- QR code tickets
- Attendance tracking
- Sending certificates
- Collecting feedback

## Who Uses Event Management?

| Person | What They Can Do |
|--------|------------------|
| **Students** | Browse events, register, get tickets, give feedback |
| **Faculty/Staff** | Create events (via Noting), manage registrations |
| **Volunteers** | Scan QR codes at event venue |
| **Admin** | Manage all events, view reports |

## Understanding Event Status

| Status | What It Means |
|--------|--------------|
| **Draft** | Event created but not visible to students |
| **Published** | Event visible, students can register |
| **Ongoing** | Event is currently happening |
| **Completed** | Event finished |
| **Cancelled** | Event was cancelled |

## Step-by-Step Flow: Complete Event Lifecycle

### PHASE 1: Creating an Event

#### Step 1: Create Event Noting
1. Login as Faculty
2. Go to Noting → Create New
3. Select Academic → Events
4. Fill event details (name, dates, capacity, fees)
5. Submit for approval

#### Step 2: Approval & Auto-Creation
1. Approver reviews and approves
2. Event is automatically created with status: **DRAFT**

#### Step 3: Configure Event (Management Page)
1. Go to Events → My Events
2. Click on the new event
3. Click "Manage" or "Settings"

**What You Should See:**
- Event management dashboard with multiple tabs

### PHASE 2: Configuring the Event

#### Tab: Overview
- Edit event description
- Update venue details
- Set long description (detailed information)

#### Tab: Settings

**Visibility Settings:**
- Who can see this event?
  - All users
  - Specific roles only
  - Specific schools/departments/programs
  - Specific batch years

**Registration Settings:**
- Auto-approve registrations? (Yes/No)
- If No → Creator must manually approve each registration
- Registration start date
- Registration end date
- Maximum capacity

**Team Settings (for team events):**
- Minimum team size
- Maximum team size
- Team registration deadline
- Allow cross-institute teams?

#### Tab: Custom Fields
Add extra questions for the registration form:
1. Click "Add Field"
2. Choose type: Text, Dropdown, Checkbox, File Upload, etc.
3. Enter field label (question)
4. Mark as required or optional
5. Save

**Example Custom Fields:**
- "T-shirt size" (Dropdown: S, M, L, XL)
- "Dietary requirements" (Text)
- "Upload ID proof" (File)

#### Tab: Coupons (for paid events)
Create discount codes:
1. Click "Add Coupon"
2. Enter coupon code (e.g., "EARLY20")
3. Select discount type: Percentage or Fixed amount
4. Enter discount value
5. (Optional) Set max uses, expiry date

#### Tab: Volunteers
Assign people to help with the event:
1. Click "Add Volunteer"
2. Search for a person
3. Assign role (Volunteer, Manager, etc.)
4. Enable/disable QR scanning permission
5. Save

### PHASE 3: Publishing the Event

1. Review all settings
2. Click "Publish"
3. Event status changes to: **PUBLISHED**
4. Students can now see and register

**What Students See:**
- Event card on Events page
- Event name, dates, venue, fee
- "Register" button

---

## Student Flow: Registering for an Event

### Step 1: Browse Events
1. Login as Student
2. Go to "Events"
3. See list of available events
4. Use filters: Search by name, filter by type

**What You Should See:**
- Event cards with basic info
- Status badges (Open, Closing Soon, Full)

### Step 2: View Event Details
1. Click on an event
2. See full details: description, dates, prizes, FAQs

**What You Should See:**
- Event header with name, type, status
- About section with description
- Dates and venue information
- Prizes (if any)
- Registration status (Open/Closed/Full)
- "Register" button

### Step 3: Register for Event

**For Free Individual Event:**
1. Click "Register"
2. Form appears with pre-filled profile info (name, email, etc.)
3. Fill any custom fields
4. Click "Submit"
5. Registration confirmed immediately (if auto-approve is on)
6. QR code ticket is generated

**For Paid Individual Event:**
1. Click "Register"
2. Fill registration form
3. (Optional) Enter coupon code → Click "Apply"
4. See discount applied to total
5. Click "Proceed to Payment"
6. Payment popup opens (Razorpay)
7. Complete payment
8. Registration confirmed
9. QR code ticket generated

**For Team Event:**
1. Click "Register"
2. Choose: Create Team OR Join Team

**If Creating Team:**
1. Enter team name
2. Search and invite team members
3. Members receive invitations
4. When they accept → Team grows
5. Once minimum size reached → "Finalize Team"
6. All members get individual QR codes

**If Joining Team:**
1. See teams looking for members
2. Click "Request to Join"
3. Team leader approves
4. You're added to the team

### Step 4: View Your Ticket
1. Go to "My Tickets" or "My Registrations"
2. See your registration with QR code
3. Can download ticket as image/PDF

**What You Should See:**
- Event name
- Your registration status (Confirmed/Pending)
- QR code
- Registration date/time

---

## Event Day: QR Code Scanning

### Volunteer/Staff Flow

#### Setting Up Scanner
1. Login as assigned Volunteer
2. Go to Events → [Event Name] → Scan
3. Scanner page opens

**What You Should See:**
- Entry/Exit toggle buttons
- Text input for QR code
- "Scan" button
- Recent scans list

#### Scanning Process
1. Select "Entry" mode
2. Student shows QR code
3. Volunteer scans or types the code
4. Click "Scan" or press Enter
5. System validates:
   - Is this QR from this event?
   - Is registration confirmed?
   - Has person already entered?

**Success Result:**
- Green checkmark
- Student name displayed
- Entry logged with timestamp

**Failure Results:**
- Red X mark
- Error message: "Invalid QR" / "Already entered" / "Not confirmed"

#### Exit Scanning
1. Switch to "Exit" mode
2. Scan student's QR code
3. Exit logged with timestamp

---

## After the Event

### Sending Certificates

1. Go to Event Management → Certificates tab
2. Upload certificate template (background image)
3. Use visual editor:
   - Add text fields (drag to position)
   - Use placeholders: [Candidate Name], [Event Name], [Date]
   - Adjust fonts, colors
4. Preview certificate
5. Select recipients:
   - All confirmed registrations
   - Only attendees (who entered)
   - Specific selections
6. Click "Send"
7. Certificates generated as PDFs
8. Emailed to each recipient

**What Recipients Get:**
- Email with subject: "Your Certificate for [Event Name]"
- PDF certificate attached
- Verification link

### Public Certificate Verification
1. Anyone can go to verification page
2. Enter verification code (from certificate)
3. System shows: Valid/Invalid certificate
4. If valid: Shows event name, recipient name, date

### Collecting Feedback

**For Students:**
1. After event, student receives feedback link
2. Or goes to event page → "Give Feedback"
3. Rates on scale of 1-10 for various aspects
4. Adds optional comments
5. Submits

**For Event Creator:**
1. Go to Event Management → Feedback tab
2. See average ratings
3. Read individual comments
4. Export feedback data

### Viewing Analytics

Event creators can see:
- Total registrations
- Confirmed vs pending vs cancelled
- Attendance rate (who actually came)
- Payment totals (for paid events)
- Registration trend over time
- Feedback scores

---

## Testing Event Management: Normal Flow

| Step | What Tester Should Do | What Should Happen |
|------|----------------------|-------------------|
| 1 | Login as Faculty | Dashboard loads |
| 2 | Create event via Noting | Noting submitted |
| 3 | Approve noting | Event created in Draft |
| 4 | Configure event settings | All settings saved |
| 5 | Add custom fields | Fields appear in registration form |
| 6 | Publish event | Status = Published |
| 7 | Login as Student | Event visible in browse |
| 8 | Register for event | Registration created |
| 9 | View My Tickets | QR code visible |
| 10 | Login as Volunteer | Can access scan page |
| 11 | Scan QR (Entry) | Entry logged, success shown |
| 12 | Scan same QR again | Error: "Already entered" |
| 13 | Scan QR (Exit) | Exit logged |
| 14 | Login as Faculty | See registrations, attendance |
| 15 | Send certificates | Certificates emailed |

## Testing Event Management: Error Cases

| Scenario | What Tester Should Do | Expected Result |
|----------|----------------------|-----------------|
| Register twice | Try registering for same event again | Error: "Already registered" |
| Event full | Register when capacity is reached | Shows "Full" or "Join Waitlist" |
| Invalid coupon | Enter wrong coupon code | Error: "Invalid coupon code" |
| Expired coupon | Use coupon after expiry date | Error: "Coupon has expired" |
| Scan wrong event QR | Scan QR from different event | Error: "Registration not found for this event" |
| Exit before entry | Scan exit without prior entry | Error: "No entry record found" |
| Unauthorized scan | Login as non-volunteer, try to scan | Error: "Permission denied" |
| Team too small | Finalize team below minimum | Error: "Minimum X members required" |
| Past registration | Try to register after deadline | Form disabled or error |

---

# HOW ALL MODULES WORK TOGETHER

## The Connection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         NOTING MODULE                           │
│                    (The Starting Point)                         │
│                                                                 │
│   All requests for events and clubs START here                  │
│   ↓                                ↓                            │
│   Event Approval               Club Approval                    │
│   ↓                                ↓                            │
└───│────────────────────────────────│───────────────────────────┘
    │                                │
    ▼                                ▼
┌─────────────────────┐    ┌─────────────────────┐
│   EVENT MODULE      │    │      DSW MODULE     │
│                     │    │                     │
│  Event auto-created │    │  Club auto-created  │
│  Configure & Publish│    │  Manage members     │
│  Student registers  │    │  Student joins      │
│  QR attendance      │    │                     │
│  Certificates       │    │                     │
└─────────────────────┘    └─────────────────────┘
         │                          │
         │                          │
         └─────────┬────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │    INTEGRATION      │
        │                     │
        │  - Club can have    │
        │    linked events    │
        │  - Club members can │
        │    be volunteers    │
        └─────────────────────┘
```

## Data Flow Between Modules

### 1. Noting → Event
- When an event noting is approved → Event record is automatically created
- Event details (name, dates, fees, sponsors) come from the noting
- Event starts in "Draft" status for further configuration

### 2. Noting → DSW
- When a club creation noting is approved → Club record is automatically created
- Club details (name, purpose, facilitator, chairperson) come from the noting
- Initial members (if any) are added to the club

### 3. DSW → Event
- When creating an event noting, you can select a linked club
- This means the event "belongs" to that club
- Club chairperson automatically gets event management permissions
- Club members can be easily assigned as event volunteers

### 4. Cross-Module User Journey

**A Complete User Story:**

1. **Day 1:** Faculty creates a noting request for "AI Workshop" event linked to "Tech Club"
2. **Day 2:** DSW office approves the noting
3. **Day 2:** System automatically creates the event in Draft status
4. **Day 3:** Faculty configures the event (adds custom fields, coupons, volunteers from Tech Club members)
5. **Day 4:** Faculty publishes the event
6. **Day 5:** Students see the event, start registering
7. **Day 5:** Students with coupon codes get discounts
8. **Day 10:** Event day - volunteers scan QR codes for entry
9. **Day 10:** Some students exit and re-enter (both logged)
10. **Day 11:** Faculty generates and sends certificates to attendees
11. **Day 12:** Students receive certificates via email
12. **Day 15:** Faculty reviews attendance and feedback analytics

---

# REAL-LIFE USAGE SCENARIOS

## Scenario 1: Annual Tech Festival

**Background:** 
The Computer Science department wants to organize a 3-day tech festival with multiple events.

**Step-by-Step Journey:**

**Week 1: Planning & Approval**
1. Faculty in-charge creates a "Festival" type noting
2. Adds 5 sub-events:
   - Hackathon (team event, paid)
   - Coding Contest (individual, free)
   - Tech Talk (seminar, free)
   - Project Exhibition (stall event)
   - Gaming Tournament (individual, paid)
3. Adds sponsor details
4. Submits for approval
5. Head of Department forwards to Dean
6. Dean approves
7. All 5 events are automatically created

**Week 2: Configuration**
1. Faculty configures each event:
   - Hackathon: Team size 2-4, registration fee ₹500, creates "EARLYBIRD" coupon for 20% off
   - Coding Contest: Max 100 participants
   - Tech Talk: No limit
   - Exhibition: Enables student stall applications
   - Gaming: Registration fee ₹100
2. Assigns Tech Club members as volunteers
3. Uploads certificate templates
4. Publishes all events

**Week 3: Registrations**
1. Students browse events
2. Some students form hackathon teams
3. Others register individually
4. Paid registrations complete via Razorpay
5. Everyone gets QR code tickets
6. Some students apply for exhibition stalls

**Week 4: Event Days**
1. Volunteers at each venue scan entry QR codes
2. System tracks attendance in real-time
3. Faculty monitors dashboard for attendance counts
4. Volunteers scan exit codes

**Week 5: Post-Event**
1. Faculty sends certificates to:
   - Hackathon winners
   - Coding contest top 3
   - All seminar attendees
   - Exhibition participants
2. Students receive certificates via email
3. Students submit feedback
4. Faculty reviews analytics and feedback

---

## Scenario 2: Creating a New Club

**Background:**
A group of students wants to start a Photography Club.

**Step-by-Step Journey:**

**Day 1: Initiation**
1. A faculty member agrees to be facilitator
2. Faculty creates a club noting:
   - Club Name: "Shutterbug Photography Club"
   - Category: Cultural
   - Purpose: "To promote photography skills and organize exhibitions"
   - Chairperson: Student leader selected
   - Initial members: 5 founding members
3. Submits for approval

**Day 3: Approval**
1. DSW office reviews the request
2. Approves the club creation
3. Club automatically appears in DSW module

**Week 1: Setup**
1. Chairperson logs in
2. Sees club in "My Clubs"
3. Updates social media links
4. Announces club to students

**Week 2: Membership**
1. Interested students browse clubs
2. Find "Shutterbug Photography Club"
3. Click "Apply to Join"
4. Chairperson reviews applications
5. Approves suitable candidates
6. Members see club in their "My Clubs"

**Month 2: Club Event**
1. Club wants to organize photo walk
2. Faculty creates event noting linked to the club
3. After approval, event is created
4. Chairperson (as club leader) can help manage the event
5. Club members are easily added as volunteers

---

## Scenario 3: Paid Workshop with Teams

**Background:**
Business school organizing a case competition with teams.

**Journey:**

1. **Noting:** Faculty creates event noting
   - Type: Competition
   - Team event: Yes
   - Team size: 3-5 members
   - Fee: ₹300 per team
   - Prizes: Cash awards

2. **Configuration:**
   - Adds custom field: "Team college name"
   - Adds custom field: "Team captain phone"
   - Creates coupon "BSCHOOL50" for partner colleges
   - Sets deadline for team formation

3. **Registration:**
   - Student A creates team "Strategists"
   - Invites 4 classmates
   - 3 accept, 1 declines
   - Team has 4 members (minimum 3 met)
   - Team leader finalizes
   - System shows: Payment required

4. **Payment:**
   - Leader sees total: ₹300
   - Leader enters coupon "BSCHOOL50"
   - Discount applied: ₹50 off
   - Pays ₹250 via Razorpay
   - All 4 team members get confirmed
   - All 4 get individual QR codes

5. **Event Day:**
   - Each team member scans their own QR
   - All entries logged separately
   - Attendance tracked per person

6. **After Event:**
   - Certificates sent to winning teams
   - Individual certificates to each team member

---

# COMPLETE TESTING GUIDE

## Pre-Testing Setup

Before testing, ensure:
1. You have login credentials for: Admin, Faculty, Student, Volunteer
2. System is running and accessible
3. Test data is available or can be created

## Module-by-Module Testing Checklist

### Noting Module Tests

#### Create Noting
- [ ] Can create event noting with all fields
- [ ] Can create club creation noting
- [ ] Can save as draft
- [ ] Can submit for approval
- [ ] Cannot submit with empty required fields
- [ ] Dates validation works (end after start)
- [ ] File uploads work (attachments)

#### Approval Workflow
- [ ] Approver sees pending notings
- [ ] Can approve - status changes correctly
- [ ] Can reject with reason - creator sees reason
- [ ] Can forward to another person
- [ ] Can revert for changes
- [ ] After final approval, entity is created

#### View & History
- [ ] Can view noting details
- [ ] Can see approval history
- [ ] Can see all actions taken

### DSW Module Tests

#### Categories (Admin)
- [ ] Can create new category
- [ ] Can edit category
- [ ] Can deactivate category
- [ ] Deactivated category not shown in club creation

#### Club Creation
- [ ] Multi-step form works
- [ ] Can search and select facilitator
- [ ] Can search and select chairperson
- [ ] Can add initial members
- [ ] All validations work
- [ ] Club created after noting approval

#### Club Management
- [ ] Can view club details
- [ ] Can edit allowed fields (email, social media)
- [ ] Cannot edit restricted fields (name, category)
- [ ] Can add member with role
- [ ] Can remove member
- [ ] Cannot remove chairperson

#### Applications
- [ ] Student can apply to join
- [ ] Cannot apply to same club twice
- [ ] Chairperson/Faculty can approve
- [ ] Can reject with note
- [ ] Student sees application status

#### Statistics
- [ ] Admin can view statistics
- [ ] Counts are accurate
- [ ] Charts display correctly

### Event Module Tests

#### Event Discovery
- [ ] Published events visible to students
- [ ] Draft events NOT visible to students
- [ ] Visibility rules work (department/role filters)
- [ ] Search works
- [ ] Filters work

#### Event Registration
- [ ] Can register for free event
- [ ] Can register for paid event (payment flow)
- [ ] Coupon codes work (discount applied)
- [ ] Invalid coupons rejected
- [ ] Cannot register twice
- [ ] Cannot register after deadline
- [ ] Cannot register when full
- [ ] QR code generated after registration

#### Team Registration
- [ ] Can create team
- [ ] Can invite members
- [ ] Members can accept/decline
- [ ] Can finalize team at minimum size
- [ ] Cannot finalize below minimum
- [ ] All team members get individual registrations

#### QR Scanning
- [ ] Volunteer can access scan page
- [ ] Entry scan works
- [ ] Exit scan works
- [ ] Invalid QR rejected
- [ ] Double entry prevented
- [ ] Exit without entry prevented

#### Certificates
- [ ] Can upload template
- [ ] Visual editor works
- [ ] Text fields draggable
- [ ] Placeholders replaced correctly
- [ ] Test send works
- [ ] Bulk send works
- [ ] Certificates received via email
- [ ] Verification link works

#### Feedback
- [ ] Student can submit feedback
- [ ] Rating system works
- [ ] Comments saved
- [ ] Creator can view feedback

---

## Common Error Messages to Verify

| Error | When It Should Appear |
|-------|----------------------|
| "Please fill all required fields" | Missing required form fields |
| "Invalid coupon code" | Coupon not found |
| "Coupon has expired" | Coupon past expiry date |
| "Already registered" | Trying to register twice |
| "Registration is full" | Event at capacity |
| "Registration closed" | Past registration deadline |
| "Permission denied" | No access rights |
| "Invalid QR code" | QR not recognized |
| "Already entered" | Double entry scan |
| "No entry record found" | Exit without entry |
| "Team name already exists" | Duplicate team name |
| "Minimum X members required" | Team too small |

---

## Tips for Testers

### General Tips
1. Always clear browser cache before testing
2. Test in incognito/private mode for login tests
3. Take screenshots of errors
4. Note exact error messages
5. Check what happens after page refresh

### Noting Testing Tips
1. Create multiple notings of different types
2. Test the entire approval chain
3. Verify auto-creation of events/clubs
4. Check copy distribution works

### DSW Testing Tips
1. Test as different roles (Faculty, Student, Admin)
2. Verify membership count accuracy
3. Test audit logs are created
4. Check category filters work

### Event Testing Tips
1. Test both free and paid events
2. Test both individual and team events
3. Verify payment amounts with and without coupons
4. Check QR scanning in Entry and Exit modes
5. Verify certificates have correct recipient names
6. Test email delivery (check spam folder too)

---

## Test Data Suggestions

### Test Users
- 1 Admin user
- 2 Faculty users (1 to create, 1 to approve)
- 5 Student users (for teams, registrations)
- 2 Staff users

### Test Events
- Free individual event
- Paid individual event (₹100)
- Free team event (3-5 members)
- Paid team event (₹500 per team)
- Event with custom fields
- Event with coupons

### Test Clubs
- Cultural club
- Technical club
- Sports club

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**For:** SGT University Management System
