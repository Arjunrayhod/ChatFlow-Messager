# ChatFlow — UI Design Specification

> Version 1.0.0 | Status: APPROVED | Single Source of Truth for Design Tokens

## 1. Overview & Core Philosophy

ChatFlow is a distraction-free, privacy-first mobile messaging client designed for high readability, instant visual comprehension, and tactile ergonomics. The visual design follows clean, modern mobile ergonomics, rejecting decorative AI embellishments, neon glows, uncalibrated gradients, and non-standard spacing.

---

## 2. Color Palette (WCAG AA Compliant)

All colors are strictly mapped to purpose-driven semantic tokens. Every token provides both **Light** and **Dark** variants.

| Token Name | Light Hex | Dark Hex | Role & Purpose | WCAG Contrast (Min) |
| :--- | :--- | :--- | :--- | :--- |
| `color.primary` | `#008069` | `#00A884` | WhatsApp-inspired Emerald Green. Primary branding, active tabs, main action buttons. | >= 4.5:1 vs background |
| `color.primaryVariant` | `#006854` | `#008f70` | Pressed state & emphasized primary actions. | >= 4.5:1 |
| `color.secondary` | `#25D366` | `#25D366` | Vibrant accent, unread notification counter badge, online indicator. | >= 3.0:1 |
| `color.background` | `#FFFFFF` | `#121B22` | Root window & screen canvas background. | Base |
| `color.surface` | `#F0F2F5` | `#1F2C34` | Chat bubble (received), card containers, list headers, search bar background. | Base |
| `color.surfaceEmphasized` | `#E9EDEF` | `#2A3942` | Pressed list item background, modal cards. | Base |
| `color.bubbleSent` | `#E7FFDB` | `#005C4B` | Sent message bubble background. | >= 4.5:1 vs text |
| `color.textPrimary` | `#111B21` | `#E9EDEF` | Main headers, message body, username text, primary button labels. | >= 7:1 (AAA) |
| `color.textSecondary` | `#667781` | `#8696A0` | Timestamps, status subtitles, message previews, icon tints. | >= 4.5:1 (AA) |
| `color.textDisabled` | `#8696A0` | `#667781` | Inactive placeholders, disabled button text. | >= 3:1 |
| `color.textInverse` | `#FFFFFF` | `#111B21` | Text placed on top of solid `color.primary` buttons. | >= 4.5:1 |
| `color.success` | `#1FA855` | `#25D366` | Verification badges, delivery double checkmarks, positive alerts. | >= 4.5:1 |
| `color.warning` | `#F15C6D` | `#F7808E` | Temporary warning alerts, mute status, unverified session notices. | >= 4.5:1 |
| `color.error` | `#EA0038` | `#EF5350` | Failed message delivery, destructive action buttons (Delete Chat, Leave Group). | >= 4.5:1 |
| `color.info` | `#027EB5` | `#53BDEB` | Informational system messages, encryption notifications. | >= 4.5:1 |
| `color.divider` | `#E9EDEF` | `#222E35` | 1px separator lines between list items, section boundaries. | N/A (Structural) |
| `color.overlay` | `rgba(11, 20, 26, 0.45)` | `rgba(0, 0, 0, 0.70)` | Dimmer behind action sheets, image viewer backdrops, alert modals. | N/A |

---

## 3. Typography Scale

ChatFlow uses platform-native system typefaces for optimal rendering performance, zero layout shift, and respect for user font scale preferences.
- **iOS**: `-apple-system`, `SF Pro Display`, `SF Pro Text`
- **Android**: `Roboto`, `Noto Sans`

| Scale Token | Size (sp/px) | Line Height | Weight | Letter Spacing | Usage Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `type.display` | 28px | 34px | Bold (700) | -0.4px | Onboarding welcome headlines, call screen user name |
| `type.h1` | 22px | 28px | Bold (700) | -0.2px | Main screen top headers (Chats, Status, Calls) |
| `type.h2` | 18px | 24px | SemiBold (600) | -0.1px | Modal dialog titles, profile section titles |
| `type.h3` | 16px | 22px | SemiBold (600) | 0.0px | Contact list row name, chat room header title |
| `type.body` | 15px | 20px | Regular (400) | 0.0px | Chat message bubble content, input field text |
| `type.bodyMedium` | 15px | 20px | Medium (500) | 0.0px | Chat message previews (unread/bold) |
| `type.caption` | 12px | 16px | Regular (400) | +0.2px | Timestamps, unread counters, subtitle metadata |
| `type.button` | 15px | 20px | SemiBold (600) | +0.1px | Interactive button labels (CTA, Send, Confirm) |
| `type.overline` | 11px | 14px | Bold (700) | +0.8px | Uppercase section badges, group participant status |

---

## 4. Spacing Scale

Based on a strict 4px grid. No non-scale margin or padding values are permitted.

| Token | Value | Allowed Contexts |
| :--- | :--- | :--- |
| `spacing.xxs` | 4px | Gap between timestamp and delivery double ticks, badge inner padding |
| `spacing.xs` | 8px | Gap between avatar and online badge, bubble internal vertical padding |
| `spacing.sm` | 12px | Horizontal padding inside message bubble, list item vertical padding |
| `spacing.md` | 16px | Default screen edge gutter, chat input bar horizontal padding |
| `spacing.lg` | 20px | Spacing between form input blocks, header vertical padding |
| `spacing.xl` | 24px | Card container inner padding, bottom sheet top header padding |
| `spacing.xxl` | 32px | Empty state graphic margin, onboarding step gap |
| `spacing.xxxl` | 40px | Major section separation |
| `spacing.huge` | 48px | Minimum touch target bounding box height/width (per Mobile UX standards) |

---

## 5. Corner Radius Scale

| Token | Value | Application |
| :--- | :--- | :--- |
| `radius.none` | 0px | Full width banner, bottom docked navigation bar |
| `radius.sm` | 4px | Small status indicators, code blocks inside messages |
| `radius.md` | 8px | Message bubbles (corner notch side), modal dialogs, search text inputs |
| `radius.lg` | 12px | Standard message bubble outer corners, image thumbnail cards |
| `radius.xl` | 16px | Action sheets, floating action containers |
| `radius.pill` | 999px | Avatars, filter chips, circular floating action buttons, badge pills |

---

## 6. Elevation & Shadows

ChatFlow embraces clean, flat layers with subtle elevation where required for hierarchy.

| Token | Android Elevation | iOS Shadow Parameters | Web Box-Shadow | Context |
| :--- | :--- | :--- | :--- | :--- |
| `elevation.0` | 0 | None | `none` | Standard list items, flat bubbles |
| `elevation.1` | 1 | `offset: {0, 1}`, `opacity: 0.08`, `radius: 2` | `0px 1px 3px rgba(0,0,0,0.08)` | Top navigation bar separator, chat bubble |
| `elevation.2` | 3 | `offset: {0, 2}`, `opacity: 0.12`, `radius: 4` | `0px 3px 6px rgba(0,0,0,0.12)` | Floating Action Button (FAB), unread jump pill |
| `elevation.3` | 6 | `offset: {0, 4}`, `opacity: 0.16`, `radius: 8` | `0px 6px 12px rgba(0,0,0,0.16)` | Popover context menu, dropdown actions |
| `elevation.4` | 12 | `offset: {0, 8}`, `opacity: 0.24`, `radius: 16` | `0px 12px 24px rgba(0,0,0,0.24)` | Bottom sheets, full modal dialogs |

---

## 7. Icon Size Tokens

All icons are rendered strictly using these predefined bounding boxes:

| Token | Bounding Box | Touch Target Min | Usage |
| :--- | :--- | :--- | :--- |
| `icon.xs` | 16px | 48px (padded) | Delivery status ticks (single/double), lock icon |
| `icon.sm` | 20px | 48px (padded) | Input attachment icons, trailing chevron |
| `icon.md` | 24px | 48px (padded) | Standard navigation bar icons, audio mic, camera trigger |
| `icon.lg` | 28px | 48px (padded) | Media viewer controls, call action icons |
| `icon.xl` | 32px | 56px (padded) | Floating Action Button icon, call hangup trigger |

---

## 8. Motion Tokens

Transitions must feel instantaneous and natural without sluggish spring oscillations.

| Token | Duration | Easing | Usage |
| :--- | :--- | :--- | :--- |
| `motion.fast` | 150ms | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Button press feedback, icon highlight, checkbox toggle |
| `motion.normal` | 250ms | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Screen push/pop, bottom sheet open/close, tab transition |
| `motion.slow` | 400ms | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Fullscreen image lightbox expand/collapse, status bar hide |

---

## 9. STRICTLY FORBIDDEN STYLING (RULE 0.7)

1. **NO Hardcoded Hex Colors**: Hex codes outside `apps/mobile/src/theme/tokens.ts` are strictly rejected by the auditor.
2. **NO Arbitrary Padding / Margin / Font Sizes**: Magic numbers like `padding: 13`, `fontSize: 17.5` are rejected.
3. **NO Decorative Gradients**: Gradients are forbidden everywhere except authentic status camera filters if approved in future phases.
4. **NO Glow or Bloom Effects**: No `textShadow`, no neon borders, no pulsating cyberpunk glowing rings.
5. **NO Shadows Beyond `elevation.4`**: Massive blurry shadows are prohibited.
6. **NO Phone Numbers**: Never display, format, or suggest a telephone number string anywhere in UI or placeholders.
