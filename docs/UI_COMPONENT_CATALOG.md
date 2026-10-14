# ChatFlow — UI Component Catalog

> Version 1.0.0 | Status: APPROVED | Reference for mobile UI components and states

## 1. Atoms

### 1.1 Button (`<Button />`)
- **Purpose**: Interactive trigger for primary actions, submissions, and dialog confirmations.
- **Props**:
  - `label`: string (Required)
  - `variant`: `'primary' | 'secondary' | 'ghost' | 'danger'` (Default: `'primary'`)
  - `size`: `'sm' | 'md' | 'lg'` (Default: `'md'`)
  - `icon`: IconName (Optional leading icon)
  - `isLoading`: boolean (Default: `false`)
  - `isDisabled`: boolean (Default: `false`)
  - `fullWidth`: boolean (Default: `false`)
  - `onPress`: () => void
- **States**:
  - `default`: Variant surface background + crisp typography.
  - `pressed`: Opacity 0.85 + subtle scale (0.98).
  - `disabled`: Opacity 0.4, pointer-events none, background `surfaceEmphasized`.
  - `loading`: Text hidden, centered `<ActivityIndicator />` in matching contrast color.
  - `focus`: 2px focus ring using `color.primary` (web/keyboard nav).
- **Variants**:
  - `primary`: Background `color.primary`, text `color.textInverse`.
  - `secondary`: Background `color.surface`, border `1px solid color.divider`, text `color.textPrimary`.
  - `ghost`: Transparent background, text `color.primary`.
  - `danger`: Background `color.error`, text `color.textInverse`.

---

### 1.2 IconButton (`<IconButton />`)
- **Purpose**: Compact touch target for navigation bar triggers, media send buttons, and voice triggers.
- **Props**:
  - `name`: IconName (Required)
  - `size`: `'sm' | 'md' | 'lg'` (Default: `'md'`)
  - `color`: string (Optional override, defaults to token)
  - `variant`: `'standard' | 'filled' | 'tonal'`
  - `accessibilityLabel`: string (Required for screen readers)
  - `onPress`: () => void
- **States**:
  - `default`: Pure glyph with min touch-target padding (48x48px).
  - `pressed`: Circular ripple / opacity 0.7.
  - `disabled`: Glyph color `color.textDisabled`.

---

### 1.3 Badge (`<Badge />`)
- **Purpose**: Displays unread count pills, presence status dots, and call indicators.
- **Props**:
  - `content`: string | number | null (e.g., `"5"`, `"99+"`, or null for dot badge)
  - `variant`: `'counter' | 'online' | 'offline' | 'away' | 'status'`
  - `size`: `'sm' | 'md'`
- **States**:
  - `counter`: Green background `#25D366`, white text, pill radius.
  - `online`: Dot badge 10px `#25D366` with 2px background border.
  - `offline`: Dot badge `#8696A0`.
  - `away`: Dot badge `#F15C6D`.

---

### 1.4 Avatar (`<Avatar />`)
- **Purpose**: Displays user profile avatar image, fallback initials, or group icon.
- **Props**:
  - `uri`: string | null
  - `name`: string (Required for initials fallback)
  - `size`: `'sm' (32px) | 'md' (44px) | 'lg' (56px) | 'xl' (80px)`
  - `presence`: `'online' | 'offline' | 'away' | null`
- **States**:
  - `loaded`: Renders circular image with `radius.pill`.
  - `fallback`: Shows uppercase 1 or 2 letter initials with deterministic pastel background.
  - `withPresence`: Trailing bottom-right aligned `<Badge variant="online" />`.

---

### 1.5 TextInputField (`<TextInputField />`)
- **Purpose**: Form inputs for username setup, search bar, and user profile bios.
- **Props**:
  - `value`: string
  - `onChangeText`: (text: string) => void
  - `placeholder`: string
  - `label`: string (Optional)
  - `prefix`: string (e.g. `"@"`)
  - `errorMessage`: string | null
  - `autoFocus`: boolean
- **States**:
  - `default`: Border `1px solid color.divider`, background `color.surface`.
  - `focus`: Border `1.5px solid color.primary`.
  - `error`: Border `1.5px solid color.error`, renders helper error text below.
  - `disabled`: Background `color.surfaceEmphasized`, non-editable.

---

## 2. Molecules & Organisms

### 2.1 ChatListItem (`<ChatListItem />`)
- **Purpose**: Renders conversation row in the main chat inbox.
- **Layout**:
  - Left: `<Avatar size="md" />`
  - Middle: Display Name + Last Message snippet (with icon if photo/voice)
  - Right: Timestamp + Unread Badge / Status Ticks
- **States**:
  - `default`: Clear white/dark canvas.
  - `pressed`: Background highlights to `color.surfaceEmphasized`.
  - `unread`: Display Name and Message preview rendered in `type.bodyMedium` with green badge.

---

### 2.2 MessageBubble (`<MessageBubble />`)
- **Purpose**: Renders individual chat message in the conversation room.
- **Variants**:
  - `sent`: Aligned right, background `color.bubbleSent`, sender timestamp + delivery double tick.
  - `received`: Aligned left, background `color.surface`, timestamp.
- **States**:
  - `sending`: Clock icon indicator.
  - `sent`: Single grey tick.
  - `delivered`: Double grey ticks.
  - `read`: Double blue/green ticks.
  - `failed`: Red exclamation icon with tap-to-retry action.

---

### 2.3 StatusBanner (`<StatusBanner />`)
- **Purpose**: In-app notice for connection status, offline state, or call alerts.
- **Variants**:
  - `offline`: Background `color.warning`, label "Connecting to ChatFlow...".
  - `error`: Background `color.error`, label "Network error. Tap to retry".
  - `connected`: Background `color.success`, auto-dismisses after 2 seconds.

---

### 2.4 EmptyStateView (`<EmptyStateView />`)
- **Purpose**: Informative empty placeholders when chats, contacts, or calls are empty.
- **Props**:
  - `title`: string
  - `description`: string
  - `actionLabel`?: string
  - `onAction`?: () => void
- **States**:
  - Centered icon, heading in `type.h2`, description in `type.body` with `color.textSecondary`.
