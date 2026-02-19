# Advanced Registration System - Migration Guide

## Overview

This document describes the upgrade from the simple 1-click registration system to a fully dynamic, multi-mode advanced registration system with team management capabilities.

## New Features

### 1. Smart Registration Form
- Auto-filled forms with user profile data (name, email, phone, location, institute)
- Dynamic custom fields configured by event organizers
- Field types: text, number, email, phone, URL, date, time, dropdown, checkbox, radio, file upload
- Real-time validation with custom rules

### 2. Dual Registration Modes
- **Individual registration**: For solo participation events
- **Team registration**: For team-based events with full team management

### 3. Team Management Module
- **Create a team**: Team leaders can create teams and invite members
- **Join a team**: Users can browse teams looking for members and request to join
- **Invitations system**: Send invitations, accept/decline received invitations
- **Request system**: Request to join teams, team leaders can accept/reject requests
- **Looking for teammates**: Users can indicate they're looking for teammates

### 4. Admin Configuration
- Custom field builder with drag-and-drop reordering
- Team size configuration (min/max members)
- Auto-approve registrations toggle
- Team registration deadline settings
- Form editing permissions after submission

## Database Changes

### New Enums

```prisma
enum EventFieldType {
  text
  textarea
  number
  email
  phone
  url
  date
  time
  datetime
  dropdown
  checkbox
  radio
  file
  image
}

enum EventTeamStatus {
  forming
  complete
  confirmed
  disqualified
  withdrawn
}

enum EventTeamMemberRole {
  leader
  member
}

enum EventTeamMemberStatus {
  pending
  confirmed
  removed
  left
}

enum EventInvitationStatus {
  pending
  accepted
  declined
  expired
  cancelled
}

enum EventRequestStatus {
  pending
  accepted
  rejected
  cancelled
}
```

### Updated RegistrationStatus Enum

```prisma
enum RegistrationStatus {
  pending
  approved
  rejected          // NEW
  cancelled
  waitlisted
  checked_in
  completed
  no_show
  draft             // NEW
  incomplete_team   // NEW
}
```

### New Models

#### EventCustomField
Stores custom form fields configured by event organizers.

```prisma
model EventCustomField {
  id              String         @id @default(uuid())
  eventId         String
  fieldName       String
  fieldLabel      String
  fieldType       EventFieldType
  isRequired      Boolean        @default(false)
  options         Json?
  placeholder     String?
  helpText        String?
  validationRules Json?
  displayOrder    Int            @default(0)
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  Event          Event            @relation(fields: [eventId], references: [id], onDelete: Cascade)
  EventFieldResponse EventFieldResponse[]

  @@index([eventId])
}
```

#### EventFieldResponse
Stores user responses to custom fields.

```prisma
model EventFieldResponse {
  id             String     @id @default(uuid())
  registrationId String
  fieldId        String
  value          Json
  fileUrl        String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  EventRegistration EventRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  EventCustomField  EventCustomField  @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@unique([registrationId, fieldId])
  @@index([registrationId])
  @@index([fieldId])
}
```

#### EventTeam
Stores team information for team-based events.

```prisma
model EventTeam {
  id                String          @id @default(uuid())
  teamId            String          @unique
  eventId           String
  name              String
  status            EventTeamStatus @default(forming)
  lookingForMembers Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  Event              Event               @relation(fields: [eventId], references: [id], onDelete: Cascade)
  EventTeamMember    EventTeamMember[]
  EventTeamInvitation EventTeamInvitation[]
  EventTeamRequest   EventTeamRequest[]
  EventRegistration  EventRegistration[]

  @@index([eventId])
  @@index([status])
}
```

#### EventTeamMember
Stores team membership information.

```prisma
model EventTeamMember {
  id        String                @id @default(uuid())
  teamId    String
  userId    String
  role      EventTeamMemberRole   @default(member)
  status    EventTeamMemberStatus @default(pending)
  joinedAt  DateTime?
  leftAt    DateTime?
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt

  EventTeam EventTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
}
```

#### EventTeamInvitation
Stores team invitations.

```prisma
model EventTeamInvitation {
  id          String                 @id @default(uuid())
  teamId      String
  inviterId   String
  inviteeId   String
  status      EventInvitationStatus  @default(pending)
  message     String?
  respondedAt DateTime?
  expiresAt   DateTime?
  createdAt   DateTime               @default(now())
  updatedAt   DateTime               @updatedAt

  EventTeam EventTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  inviter   User      @relation("InvitationsSent", fields: [inviterId], references: [id], onDelete: Cascade)
  invitee   User      @relation("InvitationsReceived", fields: [inviteeId], references: [id], onDelete: Cascade)

  @@unique([teamId, inviteeId])
  @@index([teamId])
  @@index([inviteeId])
}
```

#### EventTeamRequest
Stores join requests from users to teams.

```prisma
model EventTeamRequest {
  id          String             @id @default(uuid())
  teamId      String
  requesterId String
  status      EventRequestStatus @default(pending)
  message     String?
  respondedAt DateTime?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  EventTeam EventTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  requester User      @relation(fields: [requesterId], references: [id], onDelete: Cascade)

  @@unique([teamId, requesterId])
  @@index([teamId])
  @@index([requesterId])
}
```

### Updated Event Model

Added fields:
- `autoApproveRegistration` (Boolean)
- `maxTeamLimit` (Int?)
- `teamRegistrationDeadline` (DateTime?)
- `allowEditAfterSubmission` (Boolean)
- `requireFormSubmission` (Boolean)
- `lookingForTeammatesEnabled` (Boolean)

### Updated EventRegistration Model

Added fields:
- `teamId` (String?)
- `formData` (Json?)
- `formSubmittedAt` (DateTime?)
- `isTeamLeader` (Boolean)
- `lookingForTeammates` (Boolean)

## Migration Steps

### 1. Generate Migration

```bash
cd backend
npx prisma migrate dev --name add_advanced_registration
```

### 2. Run Migration

```bash
npx prisma migrate deploy
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

## New API Endpoints

### Registration Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/:id/registration-form` | Get registration form with custom fields |
| POST | `/api/events/:id/register-with-form` | Submit registration with form data |
| GET | `/api/events/registration-dashboard` | Get user's registration dashboard |

### Team Management Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events/:id/teams` | Create a new team |
| GET | `/api/events/:id/my-team` | Get user's team for this event |
| GET | `/api/events/:id/teams/:teamId` | Get team details |
| GET | `/api/events/:id/teams/looking-for-members` | Get teams looking for members |
| GET | `/api/events/:id/users-looking-for-teammates` | Get users looking for teammates |
| GET | `/api/events/:id/search-users` | Search users to invite |
| POST | `/api/events/:id/teams/:teamId/invite` | Send team invitation |
| POST | `/api/events/:id/teams/:teamId/request-join` | Request to join team |
| GET | `/api/events/:id/invitations/my` | Get user's invitations |
| GET | `/api/events/:id/requests/my` | Get user's requests |
| POST | `/api/events/:id/invitations/:id/respond` | Respond to invitation |
| POST | `/api/events/:id/requests/:id/respond` | Respond to join request |
| PATCH | `/api/events/:id/looking-for-teammates` | Toggle looking for teammates |
| PATCH | `/api/events/:id/teams/:teamId/looking-for-members` | Toggle team looking for members |
| DELETE | `/api/events/:id/teams/:teamId/members/:memberId` | Remove member from team |
| DELETE | `/api/events/:id/teams/:teamId` | Cancel/delete team |

### Custom Field Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/:id/custom-fields` | Get custom fields for event |
| POST | `/api/events/:id/custom-fields` | Create custom field |
| PATCH | `/api/events/:id/custom-fields/:fieldId` | Update custom field |
| DELETE | `/api/events/:id/custom-fields/:fieldId` | Delete custom field |
| PATCH | `/api/events/:id/custom-fields/reorder` | Reorder custom fields |
| GET | `/api/events/:id/registration-settings` | Get registration settings |
| PATCH | `/api/events/:id/registration-settings` | Update registration settings |

## New Frontend Pages

### `/events/[id]/registration`
Smart registration form with auto-filled profile data and dynamic custom fields.

### `/events/[id]/registration/team`
Team management page with:
- Create team tab
- Join team tab
- Invitations sidebar
- Requests sidebar

### `/events/[id]/manage/registration-settings`
Admin page for configuring:
- Registration settings (auto-approve, form requirements)
- Team settings (min/max size, deadlines)
- Custom form fields (add/edit/delete/reorder)

## Usage

### For Event Organizers

1. Navigate to Event Management
2. Click "Registration Settings"
3. Configure general settings:
   - Enable/disable auto-approve
   - Require form submission
   - Allow editing after submission
4. Configure team settings (for team events):
   - Set min/max team sizes
   - Set team registration deadline
   - Enable "Looking for teammates" feature
5. Add custom fields as needed
6. Save settings

### For Participants

1. Click "Register" on event page
2. Fill in auto-populated profile fields
3. Complete any custom fields
4. For team events:
   - Create a new team, OR
   - Browse and join an existing team
   - Manage invitations and requests
5. Complete registration

## Backward Compatibility

- Existing simple registrations continue to work
- Events without custom fields show only base profile fields
- Individual events skip team management step
- `requireFormSubmission = false` allows 1-click registration

## Files Changed

### Backend
- `backend/prisma/schema.prisma` - Database schema updates
- `backend/src/modules/event-management/services/registration.service.js` - New service
- `backend/src/modules/event-management/services/team.service.js` - New service
- `backend/src/modules/event-management/services/customField.service.js` - New service
- `backend/src/modules/event-management/controllers/registration.controller.js` - New controller
- `backend/src/modules/event-management/controllers/team.controller.js` - New controller
- `backend/src/modules/event-management/controllers/customField.controller.js` - New controller
- `backend/src/modules/event-management/routes/event.routes.js` - Updated routes

### Frontend
- `frontend/src/features/event-management/types/event.types.ts` - New type definitions
- `frontend/src/features/event-management/services/event.service.ts` - New API methods
- `frontend/src/app/events/[id]/registration/page.tsx` - New registration form page
- `frontend/src/app/events/[id]/registration/team/page.tsx` - New team management page
- `frontend/src/app/events/[id]/manage/registration-settings/page.tsx` - New admin settings page
