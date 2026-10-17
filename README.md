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

## Browser and Android calling

Calling uses browser WebRTC on the web and `react-native-webrtc` in native builds. The signaling server exchanges offers, answers, and ICE candidates; WebRTC carries encrypted audio/video directly when possible and through TURN when network rules prevent a direct connection. The native WebRTC module needs a rebuilt APK and does not run inside Expo Go.

For reliable calling across mobile carriers, office Wi-Fi, and restrictive NATs, configure a Coturn-compatible relay on the backend before deployment:

```env
TURN_HOST=turn.your-domain.example
TURN_SHARED_SECRET=replace-with-the-same-static-auth-secret-configured-in-coturn
TURN_UDP_PORT=3478
TURN_TCP_PORT=3478
TURN_TTL_SECONDS=3600
```

Keep `TURN_SHARED_SECRET` on the server only. The authenticated `/api/calls/ice-servers` endpoint creates short-lived per-user credentials for the browser and APK. Until the relay is configured, the app falls back to STUN; calls can fail on networks that require relaying.

A Coturn configuration is provided in `coturn/turnserver.conf` and `coturn/docker-compose.yml`. It enables UDP/TCP TURN on port 3478. Copy `coturn/.env.example` to `coturn/.env`, generate a random 64-character hex secret, then use that exact value for both `TURN_SHARED_SECRET` in the backend and `coturn/.env`. Never commit the real secret. The relay host must allow inbound UDP/TCP 3478 and UDP relay ports 49152–65535; if it is behind NAT, configure Coturn's external IP. TURNS/TLS is not advertised by default; enable it only after installing a valid certificate and configuring Coturn's TLS listener.

Start the dedicated relay on a cloud server or VPS with:
```bash
cd coturn
docker compose up -d
```

### Mobile Production Build Environment

In `apps/mobile/.env` and GitHub Actions (`.github/workflows/build-apk.yml`), the mobile app points to your production HTTPS backend:
```env
EXPO_PUBLIC_API_URL=https://chatflow-backend.onrender.com
EXPO_PUBLIC_SOCKET_URL=https://chatflow-backend.onrender.com
```
Secrets like `TURN_SHARED_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are strictly excluded from the mobile build.

The Android build workflow generates the native project and APK. After adding or changing native dependencies, generate a new APK; an already-installed APK cannot gain native WebRTC support through a web reload.
