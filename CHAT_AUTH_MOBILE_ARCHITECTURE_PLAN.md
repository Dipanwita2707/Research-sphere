# Chat Authentication And Mobile Application Architecture Plan

## Purpose

This document defines the recommended architecture for:

- persistent authentication for chat
- shorter-lived authentication for other UMS modules
- a dedicated mobile application for chat only
- the end-to-end request, token, and session flows

The target business requirement is:

- chat should feel like a standalone product
- users should log in once and continue using chat for days
- non-chat modules should have a shorter session lifetime for security
- mobile access should be limited to chat functionality only

The current agreed session requirement is:

- chat session: long-lived
- other UMS modules: 10-minute session

## Goals

- Make `/chat` usable with minimal login friction.
- Keep admin, HR, finance, approvals, and other sensitive modules on a short session.
- Support a dedicated mobile chat app without exposing the full UMS.
- Reuse the existing backend, chat APIs, and socket infrastructure where practical.
- Keep the design secure, revocable, and operationally manageable.

## Non-Goals

- Building a mobile app for the full UMS suite
- Making chat anonymous or unauthenticated
- Using one single token policy for every module

## Current System Observations

Based on the current codebase:

- The backend already supports JWT-based auth.
- The current JWT expiry is configured as `7d`.
- The frontend persists auth state in local storage.
- The chat feature already exists as a separate route at `/chat`.
- The API client already supports cookies and bearer tokens.

This means the project already has the building blocks needed for a split-session model. The main change is to separate chat authentication policy from general UMS authentication policy.

## Recommended High-Level Architecture

Use one backend platform with two session domains:

1. `Main UMS session`
   Used for dashboard, admin, HR, finance, approvals, research workflows, and other non-chat modules.

2. `Chat session`
   Used only for chat web access and the mobile chat application.

Both sessions may authenticate the same user identity, but they must be issued, refreshed, validated, and revoked independently.

## Recommended Session Policy

### Main UMS Session

- Access token lifetime: `10 minutes`
- Refresh strategy:
  Either no refresh token, or a very restricted refresh flow that forces revalidation frequently
- Intended usage:
  all non-chat modules
- Security posture:
  short session, suitable for sensitive system operations

### Chat Session

- Access token lifetime: `10 to 15 minutes`
- Refresh token lifetime: `7 to 30 days`
- Silent refresh: `enabled`
- Intended usage:
  web chat and mobile chat app only
- Security posture:
  login once, remain signed in across app restarts, but still allow revocation

### Why This Split Works

- The short-lived main UMS session reduces exposure on sensitive business modules.
- The chat session stays convenient because it silently refreshes in the background.
- A stolen access token is less dangerous because access tokens remain short-lived.
- A refresh token can be revoked if a device is lost or a session becomes suspicious.

## Recommended Token Model

Use separate token types with separate scopes.

### Main UMS Tokens

- `ums_access_token`
- scope: `ums`
- lifetime: `10m`

### Chat Tokens

- `chat_access_token`
- scope: `chat`
- lifetime: `10m` to `15m`

- `chat_refresh_token`
- scope: `chat_refresh`
- lifetime: `7d` to `30d`

### Recommended Token Claims

Each token should include:

- `sub`: user id
- `sid`: session id
- `scope`: `ums`, `chat`, or `chat_refresh`
- `role`: current user role
- `deviceId`: device identifier where applicable
- `iat`
- `exp`

Optional useful claims:

- `platform`: `web`, `android`, `ios`
- `app`: `ums-web`, `chat-mobile`

## Session Storage Strategy

### Web Main UMS

Store the main UMS access token in an HTTP-only secure cookie where possible.

Recommended cookie properties:

- `HttpOnly`
- `Secure`
- `SameSite=Lax` for same-site deployments
- narrow path where possible

If cross-origin deployment is required, configure cookie and CORS carefully. Avoid broad token exposure in JavaScript for the short session.

### Web Chat

Use a separate secure cookie pair for chat:

- chat access token cookie
- chat refresh token cookie

This allows the browser chat client to stay logged in without relying entirely on local storage.

### Mobile Chat App

Store tokens in secure device storage:

- `expo-secure-store` if using Expo
- `Keychain` on iOS
- `EncryptedSharedPreferences` or equivalent on Android

Never store refresh tokens in plain async storage.

## Backend Architecture

## Auth Services

Create or refactor auth into these logical services:

- `mainAuthService`
  Issues and validates main UMS access tokens

- `chatAuthService`
  Issues chat access tokens and refresh tokens

- `sessionService`
  Persists server-side session records for revocation, device tracking, and audit

- `tokenService`
  Signs and verifies JWTs with clear token type separation

## Suggested Session Table

Introduce a persistent session table for refresh-token-backed chat sessions.

Example fields:

- `id`
- `userId`
- `sessionType` with values like `ums` or `chat`
- `deviceId`
- `platform`
- `deviceName`
- `ipAddress`
- `userAgent`
- `refreshTokenHash`
- `lastUsedAt`
- `expiresAt`
- `revokedAt`
- `createdAt`

Important design rule:

- store hashed refresh tokens, not raw refresh tokens

## Suggested Auth Endpoints

### Main UMS

- `POST /api/v1/auth/login`
  Returns short-lived main UMS session

- `POST /api/v1/auth/logout`
  Ends main UMS session

- `GET /api/v1/auth/me`
  Returns current user for main UMS

### Chat Web And Mobile

- `POST /api/v1/chat-auth/login`
  Creates a chat session and returns chat access token plus refresh token

- `POST /api/v1/chat-auth/refresh`
  Exchanges refresh token for a new chat access token

- `POST /api/v1/chat-auth/logout`
  Revokes current chat session

- `POST /api/v1/chat-auth/logout-all`
  Revokes all active chat sessions for the user

- `GET /api/v1/chat-auth/me`
  Returns current user profile for chat

- `GET /api/v1/chat-auth/sessions`
  Optional session management endpoint for "logged in devices"

## Route Protection Strategy

### Main UMS Routes

Use `requireUmsAuth` middleware for:

- dashboard
- admin
- finance
- HR
- research management
- approval workflows
- settings unrelated to chat-only behavior

These routes should reject chat tokens.

### Chat Routes

Use `requireChatAuth` middleware for:

- `/chat`
- chat REST APIs
- chat upload endpoints
- chat socket handshake
- mobile chat app requests

These routes should accept only chat access tokens, not general UMS tokens.

### Why Route Separation Matters

This is the key control that allows:

- long-lived chat access
- short-lived main UMS access
- secure isolation between low-friction chat UX and higher-risk business modules

## Web Frontend Architecture

## Main Web App

Keep the current web app, but separate auth state into:

- `umsAuthStore`
- `chatAuthStore`

Do not rely on one shared auth store for all modules if the session policies differ.

### Suggested Web Behavior

- When a user logs into the full UMS, issue the `ums` session.
- When a user opens `/chat`, ensure a valid `chat` session exists.
- If no chat session exists, the system can:
  - issue one immediately after successful main login, or
  - prompt once for chat session bootstrap using existing identity

The smoother option is:

- after primary login, create both sessions
- `ums` stays short-lived
- `chat` continues refreshing independently

This gives the user one initial login while still preserving different session lifetimes.

### Recommended UX

- If the user is mainly a chat user, redirect them to `/chat` after login.
- If the `ums` session expires while the user is inside `/chat`, chat should keep working.
- If the user navigates from chat to another UMS module after the `ums` session expires, require re-authentication for that module.

## Mobile Application Architecture

## Recommendation

Build a separate chat-only mobile application using:

- `React Native`
- `Expo`
- `TypeScript`
- `Zustand`
- `Socket.IO client` if the backend socket stack is Socket.IO

## Why This Is The Best Approach

- The team already works in React and TypeScript.
- Development speed is faster than building native apps separately.
- Expo provides a strong base for notifications, permissions, builds, and device integration.
- A separate app keeps mobile scope controlled and secure.

## Mobile App Scope

The mobile app should include only:

- login
- chat list
- direct messages
- group chat
- message composer
- file attachments
- voice notes
- notifications
- profile and chat settings
- device/session management

The mobile app should not include:

- admin
- finance
- HR
- research workflows
- approvals
- broader UMS dashboards

## Mobile App Modules

Suggested app modules:

- `auth`
- `chat-list`
- `conversation`
- `groups`
- `attachments`
- `voice`
- `notifications`
- `profile`
- `settings`
- `session-management`

## Mobile State Model

Recommended stores:

- `chatAuthStore`
- `chatSessionStore`
- `chatConversationStore`
- `messageComposerStore`
- `presenceStore`
- `notificationStore`

## Mobile Security Model

- store refresh token in secure device storage
- store access token in memory where practical
- rotate access token silently
- revoke the device session on logout
- support remote session revocation from server

## Realtime Architecture

Use the existing socket infrastructure for chat, but update handshake auth to accept only valid chat access tokens.

### Recommended Socket Flow

1. Client obtains valid chat access token.
2. Client opens socket connection with chat token.
3. Backend validates token scope equals `chat`.
4. Backend binds socket to user id and active conversation subscriptions.
5. On token expiry, client refreshes and reconnects if required.

### Important Rule

Do not authenticate chat sockets with the short-lived UMS-only session. Chat sockets must depend on the chat auth model.

## Push Notification Architecture

For mobile, support push notifications for:

- new direct messages
- new group messages
- mentions
- attachment receipts if desired

Recommended flow:

1. Mobile app registers push token with backend.
2. Backend stores push token against active chat device session.
3. On new message, backend emits socket event for active users.
4. If target user is offline, backend sends push notification.

Recommended technologies:

- Expo Notifications initially
- FCM and APNs directly later if deeper control is needed

## Detailed User Flows

## Flow 1: First Login On Web

1. User submits username and password.
2. Backend validates credentials.
3. Backend issues:
   - main UMS access token with `10m`
   - chat access token
   - chat refresh token
4. Frontend stores each in its proper domain.
5. User is redirected:
   - to `/chat` for chat-first users, or
   - to `/dashboard` for full-system users

## Flow 2: User Stays In Chat For Days

1. User opens `/chat`.
2. Chat UI uses valid `chat_access_token`.
3. Access token expires after a short interval.
4. Frontend silently calls `/chat-auth/refresh`.
5. Backend validates refresh token session record.
6. Backend issues a new chat access token.
7. Chat continues without visible logout.

## Flow 3: User Tries To Open Another Module After 10 Minutes

1. User is active in chat.
2. Main UMS access token has already expired.
3. User clicks to open dashboard, admin, HR, finance, or another protected module.
4. `requireUmsAuth` rejects the expired or missing UMS session.
5. Frontend redirects user to re-authenticate for the main system.
6. Chat session remains valid unless explicitly revoked.

## Flow 4: Mobile App Login

1. User opens the mobile app.
2. User logs in with standard credentials.
3. Backend creates a `chat` session only.
4. App stores chat refresh token securely.
5. App stores or caches chat access token.
6. App connects sockets and fetches chats.
7. On later app launches, the app refreshes session silently.

## Flow 5: Logout From Mobile

1. User taps logout.
2. App calls `/chat-auth/logout`.
3. Backend revokes the active chat session record.
4. App deletes secure local tokens.
5. Socket disconnects.
6. User returns to login screen.

## Flow 6: Lost Device Or Forced Session Revocation

1. User or admin opens active session list.
2. Specific device session is selected.
3. Backend marks that session as revoked.
4. Refresh token becomes unusable.
5. Any future refresh attempt fails.
6. Existing socket connections for that session are disconnected if possible.

## Authorization Model

Authentication and authorization must remain separate.

- Authentication answers: who is the user
- Authorization answers: what the user can do

Chat authorization should continue to use existing chat group membership and permission rules. Long-lived chat login must not bypass message, group, or admin permission checks.

## Data And Service Boundaries

## Shared Backend

Keep one backend codebase, but separate concerns by module:

- auth core
- main UMS auth
- chat auth
- chat messaging
- chat sockets
- file uploads
- notifications

## Shared Identity

The same `UserLogin` identity can be reused for both session types. No need to duplicate user records for mobile chat.

## Separate Client Applications

- `ums-web`
- `chat-mobile`

These share backend services but should have separate app-level auth behavior.

## Security Considerations

### Required Controls

- hashed refresh tokens in database
- device-based session records
- refresh token rotation
- token scope validation
- server-side revocation support
- audit logging for login, refresh, logout, and revoke actions
- rate limiting on login and refresh endpoints

### Recommended Controls

- detect suspicious geo or IP changes
- allow user to see active chat devices
- force logout all chat sessions after password reset
- require re-authentication for especially sensitive account actions

### Important Risk To Avoid

Do not implement "chat stays logged in for days" by simply setting one global JWT to a very long expiry for the whole system. That would weaken the security posture of admin and other sensitive modules.

## Deployment Considerations

## Web

- Ensure cookies work correctly across frontend and backend domains.
- Review `SameSite`, `Secure`, and CORS settings.
- Ensure chat refresh endpoints are reachable from the web app.

## Mobile

- Publish as a separate app package.
- Use environment-specific API endpoints.
- Securely handle push notification keys and app secrets.

## Observability

Track:

- login success and failure
- refresh success and failure
- token revocation events
- socket auth failures
- mobile device registration failures
- session count per user

## Rollout Plan

## Phase 1: Backend Auth Refactor

- introduce token scopes
- add chat refresh token flow
- add session persistence table
- add `chat-auth` endpoints
- add `requireUmsAuth` and `requireChatAuth`

## Phase 2: Web Chat Session Split

- separate main auth store and chat auth store
- update `/chat` to use chat auth only
- keep main modules on 10-minute session
- redirect chat-first users to `/chat`

## Phase 3: Device And Session Management

- build active sessions API
- add logout-all and revoke-device actions
- add audit and monitoring

## Phase 4: Mobile App

- create chat-only React Native and Expo project
- implement login and refresh flow
- implement chat list and conversation views
- integrate sockets
- add push notifications

## Phase 5: Hardening And UX Improvements

- refresh token rotation
- session naming by device
- mention notifications
- offline queue improvements
- deep links into specific conversations

## Suggested API And Client Contract Decisions

To avoid future confusion, standardize these decisions early:

- one user identity, two session types
- chat tokens cannot access main UMS routes
- main UMS tokens cannot power mobile chat indefinitely
- all refresh tokens are stored server-side as hashed values
- every mobile device receives a unique session record

## Recommended Final Design Decision

The recommended final architecture is:

- one shared backend
- one shared identity model
- one short-lived `main UMS` session with `10-minute` lifetime
- one independent `chat` session using short-lived access token plus long-lived refresh token
- one dedicated mobile app for chat only using the chat session model

This design gives:

- low-friction chat usage
- stronger security for sensitive non-chat modules
- a clean path for mobile development
- revocation and device control
- minimal duplication of backend business logic

## Immediate Next Steps

1. Refactor backend auth into `ums` and `chat` session types.
2. Add chat refresh token storage and revocation table.
3. Split frontend auth handling for `/chat` versus the rest of the system.
4. Define mobile API contract around `chat-auth` endpoints.
5. Scaffold the chat-only mobile app using React Native and Expo.

## Appendix: Suggested Folder Direction

This is one possible future structure, not a required immediate refactor.

### Backend

```text
backend/src/modules/auth/
  services/
    token.service.js
    session.service.js
    mainAuth.service.js
    chatAuth.service.js
  controllers/
    auth.controller.js
    chatAuth.controller.js
  routes/
    auth.routes.js
    chatAuth.routes.js
  middleware/
    requireUmsAuth.js
    requireChatAuth.js
```

### Web Frontend

```text
frontend/src/shared/auth/
  umsAuthStore.ts
  chatAuthStore.ts
  authSession.types.ts
```

### Mobile App

```text
mobile-chat-app/
  src/
    app/
    features/auth/
    features/chat/
    features/conversation/
    features/notifications/
    shared/api/
    shared/storage/
    shared/socket/
    shared/state/
```

## Conclusion

The best solution is not to stretch one session model across everything. The best solution is to treat chat as a separately scoped product experience while still sharing identity and backend infrastructure with the main UMS.

That gives the desired result:

- chat login once and continue for days
- other modules expire after 10 minutes
- mobile app stays focused on chat only
- security remains much stronger than a single long-lived universal token
