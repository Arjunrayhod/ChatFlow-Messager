# ChatFlow — UI Screen Specifications

> Version 1.0.0 | Status: APPROVED | Detailed Layout Wireframes, States & Interactions

---

## 1. Gateway & Health Check Screen (`/index` or `/`)

- **Route Path**: `/`
- **Purpose**: Validates monorepo runtime status, server handshake, and redirects authenticated users to inbox or unauthenticated users to Google Sign-in.
- **Wireframe**:
```text
+------------------------------------------+
|  [Status Bar: Time, Wifi, Battery]       |
+------------------------------------------+
|                                          |
|                                          |
|                 [ Logo ]                 |
|                 ChatFlow                 |
|   Private messaging. Your Gmail. No #    |
|                                          |
|  +------------------------------------+  |
|  | Server Status: [ UP / DOWN ]       |  |
|  | Latency: 24ms                      |  |
|  | Environment: Development           |  |
|  +------------------------------------+  |
|                                          |
|  [ Button: "Check Backend Health" ]      |
|  [ Button: "Continue to Sign In" ]       |
|                                          |
+------------------------------------------+
```
- **Required States**:
  - `loading`: Pulsing indicator while checking `GET /health`.
  - `error`: Warning badge "Backend: DOWN" with retry button.
  - `success`: Green badge "Backend: UP" with latency readout.
  - `offline`: Banner "Device is offline. Check WiFi/Data".
- **Interaction Map**:
  - Tap "Check Backend Health" -> dispatches API request to `/health`, updates Zustand store.
  - Tap "Continue to Sign In" -> routes to `/(auth)/sign-in`.
- **Accessibility Notes**:
  - High contrast ratio for status badges.
  - Full screen reader label: "ChatFlow gateway. Backend server is currently up with 24 milliseconds latency."

---

## 2. Google Sign-In Screen (`/(auth)/sign-in`)

- **Route Path**: `/(auth)/sign-in`
- **Purpose**: Authenticates user via Google Firebase Auth. Strictly zero phone number prompts.
- **Wireframe**:
```text
+------------------------------------------+
|  [Status Bar]                            |
+------------------------------------------+
|                                          |
|                 [ Logo ]                 |
|            Welcome to ChatFlow           |
|                                          |
|   Simple. Secure. Reliable messaging.    |
|   Sign in with your Google account.      |
|   No phone number required. Ever.        |
|                                          |
|                                          |
|  +------------------------------------+  |
|  |  [G]  Continue with Google         |  |
|  +------------------------------------+  |
|                                          |
|   By continuing, you agree to our Terms  |
|   and Privacy Policy.                    |
+------------------------------------------+
```
- **Required States**:
  - `loading`: Google button shows spinner while OAuth webview opens.
  - `error`: Bottom toast "Failed to sign in with Google. Please retry."
  - `offline`: Disabled button with banner "Sign in requires internet connection."
- **Interaction Map**:
  - Tap "Continue with Google" -> triggers Firebase Google OAuth prompt.
- **Accessibility Notes**:
  - Minimum 48x48px touch target for OAuth CTA button.

---

## 3. Onboarding & Username Selection (`/(auth)/onboarding`)

- **Route Path**: `/(auth)/onboarding`
- **Purpose**: Mandatory post-auth setup. User picks their unique `@username` and optional avatar/bio.
- **Wireframe**:
```text
+------------------------------------------+
|  <- Back                                 |
+------------------------------------------+
|  Profile Info                            |
|  Choose your username and display name.  |
|                                          |
|               ( Avatar )                 |
|             [Add Photo]                  |
|                                          |
|  Display Name                            |
|  [ Jane Doe                            ] |
|                                          |
|  Username                                |
|  [ @janedoe                            ] |
|  * Usernames can contain letters, 0-9, _ |
|                                          |
|  About / Bio (Optional)                  |
|  [ Hey there! I am using ChatFlow.     ] |
|                                          |
|  [ Button: "Complete Setup" ]            |
+------------------------------------------+
```
- **Required States**:
  - `loading`: Debounced checking of `@username` uniqueness against backend.
  - `error`: Inline red caption "Username @janedoe is already taken."
  - `success`: Green checkmark inside input when username is valid and available.
- **Interaction Map**:
  - Typing username -> debounced validate `GET /api/users/check-username?username=...`.
  - Tap "Complete Setup" -> POST `/api/users/onboard` -> routes to `/(tabs)/chats`.
- **Accessibility Notes**:
  - Clear input labels linked with `aria-labelledby`.

---

## 4. Main Chat Inbox Screen (`/(tabs)/chats`)

- **Route Path**: `/(tabs)/chats`
- **Purpose**: Primary inbox listing all 1-on-1 and group conversations.
- **Wireframe**:
```text
+------------------------------------------+
| ChatFlow                     [Search] [:]|
| +--------------------------------------+ |
| | [Search chats by name or @username]  | |
| +--------------------------------------+ |
|  [Chats (Active)]   [Status]   [Calls]   |
+------------------------------------------+
| (A) Alex Rivers                 10:42 AM |
|     Let's review the spec.           (2) |
|------------------------------------------|
| (B) Beatriz Morales            Yesterday |
|     ✓✓ Audio message (0:14)              |
|------------------------------------------|
| (G) Core Dev Team               Monday   |
|     Devon: Build is passing!             |
|                                          |
|                                    [FAB] |
+------------------------------------------+
```
- **Required States**:
  - `loading`: 5 shimmer list item skeletons.
  - `empty`: "No conversations yet. Start a chat by searching an @username."
  - `offline`: Top banner "Connecting to server...".
- **Interaction Map**:
  - Tap conversation item -> navigate to `/chat/[id]`.
  - Tap FAB (+) -> navigate to `/contacts/new`.
  - Swipe chat item left -> reveals archive / mute options.
- **Accessibility Notes**:
  - List items have accessibilityRole="button" and describe unread count.

---

## 5. 1-on-1 Real-time Chat Room (`/chat/[id]`)

- **Route Path**: `/chat/[id]`
- **Purpose**: Real-time messaging, attachments, voice notes, read receipts.
- **Wireframe**:
```text
+------------------------------------------+
| <- (A) Alex Rivers           [Call] [Video]|
|    online                                |
+------------------------------------------+
|          [ Today - 10:40 AM ]            |
|                                          |
|  +-----------------------+               |
|  | Hey! Ready for call?  |               |
|  | 10:41 AM              |               |
|  +-----------------------+               |
|                                          |
|               +-----------------------+  |
|               | Absolutely! Let's do. |  |
|               | 10:42 AM           ✓✓ |  |
|               +-----------------------+  |
|                                          |
+------------------------------------------+
| [+] [ Type a message...          ] [Mic] |
+------------------------------------------+
```
- **Required States**:
  - `loading`: Message history spinner / skeleton bubbles.
  - `empty`: "No messages yet. Say hello to @username!"
  - `error`: Failed message with red exclamation mark and tap-to-resend.
- **Interaction Map**:
  - Tap Send -> emits socket `send_message` with optimistic UI.
  - Tap Audio Call -> initiates WebRTC offer.
  - Tap Attachment [+] -> opens camera, photo library, or document picker.
- **Accessibility Notes**:
  - Dynamic type support for message bubbles. No text truncation inside bubbles.
