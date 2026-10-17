# ChatFlow hosting guide (AWS Academy + free tiers)

This guide moves ChatFlow from temporary local tunnels to hosted browser and Android builds. It uses the AWS Academy EC2 instance already prepared for Coturn, Cloudflare Pages for the HTTPS web app, Render for the HTTPS API/Socket.IO backend, and the existing GitHub Actions workflow for APK builds.

## Target setup

| Part | Host | Purpose |
| --- | --- | --- |
| Web app | Cloudflare Pages | Stable HTTPS link for PC and phone browsers |
| API and Socket.IO | Render Web Service | Login, messaging, call signaling, and TURN credential endpoint |
| TURN media relay | AWS Academy EC2 + Coturn | Voice/video media when direct WebRTC networking fails |
| Android APK | GitHub Actions | Build and download `ChatFlow.apk` from the repository |

The `trycloudflare.com` Quick Tunnels are for temporary testing. Their addresses change and they stop working when `cloudflared` exits. Stop using them after the hosted URLs work.

## Before starting

- Confirm AWS Academy Learner Lab is active and check its remaining credits, allowed EC2 sizes, and lab end time. Academy rules and credits depend on the school/account; a resource that works today may stop when the lab expires or its budget is used.
- AWS may charge for a running instance, public IPv4 address, data transfer, or other resources. Check the Academy balance and AWS billing page before leaving resources on. AWS documents a public IPv4 free allowance only for eligible Free Tier accounts; do not assume an Academy account qualifies.
- Keep `TURN_SHARED_SECRET`, Firebase Admin private key, and Supabase service-role key private. Never put them in `apps/mobile/.env`, a GitHub Actions input, or a committed file.
- Coturn is already installed on the EC2 host at `35.175.156.217`, according to the setup session. If the Academy lab restarts or replaces the instance, re-check the IP and TURN service.

## 1. Keep Coturn on the AWS Academy EC2 instance

The EC2 Security Group needs these inbound rules for the current Coturn configuration:

| Protocol | Port | Source |
| --- | --- | --- |
| UDP | 3478 | `0.0.0.0/0` |
| TCP | 3478 | `0.0.0.0/0` |
| UDP | 49152–65535 | `0.0.0.0/0` |
| TCP | 22 (SSH) | My IP only; do not open to everyone |

Do not add an `All TCP` or `All traffic` rule. Do not open port 5349 unless Coturn TLS is explicitly configured with a valid certificate.

On the EC2 Ubuntu terminal, verify Coturn after every restart:

```bash
sudo systemctl status coturn --no-pager
```

It should show `active (running)`. The TURN host used by the backend is the EC2 public IP (currently `35.175.156.217`), not the EC2 private IP.

## 2. Deploy the API and Socket.IO backend on Render

The repository has a `render.yaml` Blueprint for `chatflow-backend`.

1. Sign in to Render and create a **Blueprint** from `Arjunrayhod/ChatFlow-Messager`.
2. Confirm the service is named `chatflow-backend` and choose the Free plan if offered.
3. In the service's Environment settings, add these production values from your own provider dashboards: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Store the Firebase private key with newlines represented as `\n` if the dashboard requires a single-line value.
4. Add `TURN_HOST=35.175.156.217` and `TURN_SHARED_SECRET` equal to the secret stored on EC2 at `/etc/turnserver.shared-secret`.
5. Set `TURN_UDP_PORT=3478`, `TURN_TCP_PORT=3478`, and `TURN_TTL_SECONDS=3600`. Keep `TURN_SHARED_SECRET` only in Render's private environment settings and on EC2.
6. In the Supabase SQL Editor, apply the SQL migration files from `supabase/migrations/` in filename order before using production accounts/data.
7. Wait for deploy to finish. The Render URL should pass this check:

```text
https://YOUR-RENDER-SERVICE.onrender.com/health
```

The health response should say `healthy`. Save the service URL; it is the API and Socket.IO URL. Do not include `/health` when setting the base URL.

### Render free-plan caveat

Render documents that free web services may spin down after 15 minutes without inbound HTTP requests or WebSocket messages, and may take about a minute to wake up. Treat this as a development/demo backend, not a reliable always-on calling service. The backend's local development database is not durable; configure the production Supabase project before using real accounts or data.

## 3. Publish the browser app on Cloudflare Pages

1. In Cloudflare Dashboard, open **Workers & Pages → Create application → Pages → Connect to Git** and select the GitHub repository.
2. Use the repository root as the project root.
3. Set the build command to:

```bash
corepack enable && corepack prepare pnpm@9 --activate && pnpm install --no-frozen-lockfile && pnpm --filter @chatflow/shared build && pnpm --filter @chatflow/mobile exec expo export --platform web
```

4. Set the build output directory to:

```text
apps/mobile/dist
```

5. Add these build environment variables in Pages, replacing the URL with the Render service URL (no `/health`):

```text
EXPO_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
EXPO_PUBLIC_SOCKET_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

6. Add the app's public client settings as Pages build variables: `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `EXPO_PUBLIC_*` values are included in browser code; only use client/public keys there. Never add Firebase Admin private keys or Supabase service-role keys to Pages.
7. Deploy. Pages provides a stable `https://YOUR-PROJECT.pages.dev` URL. Open that URL on PC and phone; microphone/camera permissions work on HTTPS after the user grants them.
8. For later updates, push changes to the configured production branch; Pages rebuilds from GitHub.

## 4. Build an Android APK using GitHub Actions

The repository already contains `.github/workflows/build-apk.yml`.

1. Push the desired code to GitHub.
2. Open the repository's **Actions → Build Android APK → Run workflow**.
3. Select the code branch to build.
4. Enter the stable Render service origin as `backend_url`, for example `https://YOUR-RENDER-SERVICE.onrender.com`. Do not use a temporary Quick Tunnel URL for a long-lived APK.
5. Start the workflow and wait for it to finish successfully.
6. Open the completed run and download the `ChatFlow-Android-APK` artifact. It contains `ChatFlow.apk`.

The APK uses the same API and Socket.IO base URL. TURN credentials are fetched securely from the backend at runtime; the shared TURN secret must never be built into the APK.

## 5. Verify browser and APK calls

1. Confirm the Render `/health` endpoint is healthy.
2. Confirm Coturn is `active (running)` on EC2 and its Security Group has the TURN ports above.
3. Open the Cloudflare Pages HTTPS link on PC and phone and sign in.
4. Grant microphone permission on both devices. Test a call in both directions and check two-way audio.
5. If the call still fails, verify the API's authenticated `/api/calls/ice-servers` response reports `relayConfigured: true`; do not share its credential fields publicly.
6. Install the GitHub Actions APK and repeat the call test. A web reload cannot add native WebRTC modules to an already-built APK; rebuild after native dependency or permission changes.

## Free-tier limits and cleanup

- Cloudflare Pages can provide a stable HTTPS static-site URL on its free plan, subject to Cloudflare's current limits and terms.
- Render Free is suitable for demos, but its sleep/wake behavior can delay calls. Check the current Render usage and billing dashboard.
- AWS Academy is not a universal free production host. Its allowed services, credits, and session lifetime are controlled by the institution. Stop the EC2 instance when not needed if the Academy rules require it, and check whether stopping it affects the Elastic IP or Coturn availability.
- Never expose SSH (port 22) to `0.0.0.0/0`. Do not commit `.env`, PEM keys, TURN shared secrets, or provider service-role keys.

## Official references

- [Expo: publishing web apps](https://docs.expo.dev/guides/publishing-websites/)
- [Cloudflare Pages: React deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Render: free service limits](https://render.com/docs/free)
- [Render: WebSockets](https://render.com/docs/websocket)
- [AWS: public IPv4 and VPC information](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
