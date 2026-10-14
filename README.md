# ChatFlow

> Private messaging. Your Gmail. No numbers.

ChatFlow is an ultra-secure, real-time messaging, status, and voice/video calling mobile application built with React Native (Expo) and a hardened Node.js/Express backend.

## Architectural Guarantees & Constraints

1. **Strictly Zero Phone Numbers**:
   - Phone numbers are completely forbidden throughout the codebase, database schema, APIs, and client interfaces.
   - Identity is anchored to Google Firebase Auth + unique `@username`.
2. **Design Tokens as Law**:
   - All mobile styles flow strictly from `apps/mobile/src/theme/tokens.ts`.
   - No hardcoded hex values, arbitrary font sizes, or uncontrolled padding/margins.
3. **Structured API Contract**:
   - Standard response envelopes: `{ ok: true, data: T }` and `{ ok: false, error: { code, message, details } }`.

## Monorepo Layout

- `apps/mobile`: React Native Expo SDK 51+ application with expo-router and Zustand.
- `apps/server`: Node.js, Express, Socket.IO, Pino, Helmet, Zod.
- `packages/shared`: Shared types, contracts, socket events, error definitions.
- `supabase/migrations`: SQL migrations and Row Level Security (RLS) policies.
- `docs/`: UI Design Spec, Component Catalog, Screen Spec, and Audit Logs.

## Quick Start

```bash
# Install all dependencies across workspaces
pnpm install

# Run type check across packages
pnpm typecheck

# Start development server
pnpm dev:server

# Start Expo mobile app
pnpm dev:mobile
```
