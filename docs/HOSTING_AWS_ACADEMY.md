# ChatFlow hosting on AWS Academy (no Render server)

This guide keeps the ChatFlow application features and source code unchanged. It moves the existing API and Socket.IO service onto the AWS Academy EC2 instance that already runs Coturn. Cloudflare Pages serves the browser app over HTTPS, and GitHub Actions builds the Android APK.

## Target setup

| Part | Where it runs | What it does |
| --- | --- | --- |
| Browser frontend | Cloudflare Pages | Stable HTTPS website for PC and phone browsers |
| API + Socket.IO | AWS Academy EC2 | Login, chat APIs, call signaling, and TURN credential endpoint |
| Coturn | Same AWS Academy EC2 | WebRTC audio/video relay |
| Database | Existing Supabase project | ChatFlow currently uses the Supabase client/data API; no database migration is needed |
| Android APK | GitHub Actions | Builds the APK using the stable EC2 API URL |

This setup avoids a sleeping Render backend. It is only online while the Academy lab and EC2 instance are running. AWS Academy availability, credits, allowed ports, and shutdown rules depend on the school/account; check its dashboard and budget. EC2 compute, public IPv4, and network usage may use credits or incur charges.

## Requirements

- The EC2 instance is Ubuntu 24.04 and Coturn is installed.
- Keep the Elastic IP currently assigned to EC2. It was `35.175.156.217` during the last setup; re-check it in AWS before using it below.
- A free DuckDNS hostname, for example `chatflow-galaxy.duckdns.org`, pointing to that Elastic IP. DuckDNS describes its service as free dynamic DNS. [DuckDNS](https://www.duckdns.org/)
- A GitHub checkout of `Arjunrayhod/ChatFlow-Messager` on the EC2 host.
- Production Firebase Admin and Supabase values from your own provider dashboards.

Do not commit `.env`, private keys, database passwords, or the TURN shared secret. Never put server secrets in Expo `EXPO_PUBLIC_*` variables or in the APK workflow's `backend_url` input.

## 1. Point a free HTTPS hostname at EC2

1. Sign in to DuckDNS and create a hostname such as `chatflow-galaxy.duckdns.org`.
2. Set its IPv4 address to the EC2 Elastic IP.
3. In the AWS Security Group, allow these inbound ports:

   | Protocol | Port | Source |
   | --- | --- | --- |
   | TCP | 80 | `0.0.0.0/0` (HTTP redirect and certificate validation) |
   | TCP | 443 | `0.0.0.0/0` (HTTPS website API and Socket.IO) |
   | UDP | 3478 | `0.0.0.0/0` (Coturn) |
   | TCP | 3478 | `0.0.0.0/0` (Coturn) |
   | UDP | 49152–65535 | `0.0.0.0/0` (Coturn media relay range) |
   | TCP | 22 | **My IP only** (SSH administration) |

   Do not add `All TCP` or `All traffic`. Do not expose the API port 4000 publicly; Caddy will proxy it locally. Do not open Coturn TLS port 5349 unless TLS is configured for Coturn.

4. Confirm the hostname resolves to the Elastic IP before continuing. If the Academy replaces the IP, update DuckDNS and the Coturn `external-ip` setting.

## 2. Run the ChatFlow API on EC2

Use the EC2 Ubuntu terminal. Run commands as the `ubuntu` user where possible; use `sudo` only for system configuration.

1. Install Git, a supported Node.js LTS version, and pnpm 9. Enable pnpm through Corepack.
2. Clone the repository into `/opt/chatflow`. If it is private, use a read-only GitHub deploy key; do not put a personal access token into a saved clone URL.
3. From `/opt/chatflow`, install and build the workspaces:

   ```bash
   pnpm install --no-frozen-lockfile
   pnpm --filter @chatflow/shared build
   pnpm --filter @chatflow/server build
   ```

4. Create the root-only config folder and environment file. `sudo nano` opens an editor; paste the values below and replace every placeholder:

   ```bash
   sudo install -d -o root -g root -m 700 /etc/chatflow
   sudo nano /etc/chatflow/chatflow.env
   ```

   ```ini
   NODE_ENV=production
   PORT=4000
   CORS_ORIGIN=https://YOUR-PROJECT.pages.dev
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_CLIENT_EMAIL=your-firebase-admin-service-account-email
   FIREBASE_PRIVATE_KEY="paste-private-key-with-escaped-\n-newlines"
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   TURN_HOST=chatflow-galaxy.duckdns.org
   TURN_SHARED_SECRET=the-same-secret-stored-on-EC2-for-coturn
   TURN_UDP_PORT=3478
   TURN_TCP_PORT=3478
   TURN_TTL_SECONDS=3600
   ```

   Replace `YOUR-PROJECT.pages.dev` with the actual Pages hostname after step 4. Save the file, then restrict its permissions:

   ```bash
   sudo chown root:root /etc/chatflow/chatflow.env
   sudo chmod 600 /etc/chatflow/chatflow.env
   ```

   The Firebase private key should use literal `\n` separators; the app server converts them to line breaks.

5. Add a systemd service so the API starts on boot. Create `/etc/systemd/system/chatflow-api.service` with:

   ```ini
   [Unit]
   Description=ChatFlow API and Socket.IO
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/opt/chatflow
   EnvironmentFile=/etc/chatflow/chatflow.env
   ExecStart=/usr/bin/node /opt/chatflow/apps/server/dist/index.js
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

   Make sure the `ubuntu` user can read the built project and that the `node` binary is at `/usr/bin/node`. If Node was installed elsewhere, use `command -v node` and put that path in `ExecStart`.

6. Save the service file, then reload systemd, enable and start `chatflow-api`:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now chatflow-api
   sudo systemctl status chatflow-api --no-pager
   ```

   The API should listen only on port 4000 internally; check it locally at `http://127.0.0.1:4000/health`.

## 3. Add HTTPS and WebSocket proxy with Caddy

1. Install Caddy using its official Ubuntu instructions: [Caddy install](https://caddyserver.com/docs/install).
2. Edit `/etc/caddy/Caddyfile` and replace the hostname:

   ```caddyfile
   chatflow-galaxy.duckdns.org {
       reverse_proxy 127.0.0.1:4000
   }
   ```

3. Validate and reload Caddy:

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

   When the hostname points to EC2 and inbound TCP ports 80 and 443 reach Caddy, it obtains and renews a public HTTPS certificate automatically. Caddy's reverse proxy supports WebSocket upgrades, which Socket.IO needs. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) · [Caddy WebSocket proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
4. Verify in a browser:

   ```text
   https://chatflow-galaxy.duckdns.org/health
   ```

   The response should say `healthy`. Do not use `http://EC2-IP:4000` in the web app.

## 4. Publish the browser app on Cloudflare Pages

1. In Cloudflare Dashboard, go to **Workers & Pages → Create application → Pages → Connect to Git** and select `Arjunrayhod/ChatFlow-Messager`.
2. Set the repository root as the project root and use this build command:

   ```bash
   corepack enable && corepack prepare pnpm@9 --activate && pnpm install --no-frozen-lockfile && pnpm --filter @chatflow/shared build && pnpm --filter @chatflow/mobile exec expo export --platform web
   ```

3. Set the output directory to `apps/mobile/dist`.
4. Add these Pages build variables, replacing the hostname with the one from step 1:

   ```text
   EXPO_PUBLIC_API_URL=https://chatflow-galaxy.duckdns.org
   EXPO_PUBLIC_SOCKET_URL=https://chatflow-galaxy.duckdns.org
   EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-public-anon-key
   ```

   `EXPO_PUBLIC_*` values are bundled into the public website; only client/public keys belong here. Do not add Firebase Admin or Supabase service-role secrets.

5. Deploy. Cloudflare Pages gives a persistent HTTPS `*.pages.dev` browser URL. Open the same URL on PC and phone; no local Expo or Quick Tunnel terminal is needed. Microphone/camera permission prompts still require the user to allow access.

## 5. Build the APK from GitHub

The existing `.github/workflows/build-apk.yml` workflow builds the Android APK.

1. Push the desired project branch to GitHub.
2. Open **Actions → Build Android APK → Run workflow** and select that branch.
3. Set `backend_url` to `https://chatflow-galaxy.duckdns.org` (origin only; no `/health`). Never put TURN or database secrets in the workflow input.
4. When the workflow succeeds, download the `ChatFlow-Android-APK` artifact. Install that APK on Android and test sign-in, chat, and calls.

## 6. Verify and maintain

1. Confirm `https://chatflow-galaxy.duckdns.org/health` returns healthy.
2. Confirm both `chatflow-api` and `coturn` show `active (running)` on EC2.
3. Confirm the authenticated `/api/calls/ice-servers` response includes `relayConfigured: true`. Do not share the generated TURN credential values.
4. Test browser-to-browser, browser-to-APK, and APK-to-APK calls in both directions.
5. To deploy server updates: pull the chosen GitHub branch, rebuild shared/server, then restart `chatflow-api`. To deploy browser updates, push the branch configured in Pages. Rebuild the APK after native dependency or permission changes.

## Academy/free-tier limits

- DuckDNS and Cloudflare Pages offer free options, subject to their current limits and terms.
- The AWS Academy lab may suspend/stop instances, restrict port access, or expire credits at course-defined times. An EC2 shutdown disconnects the API, Socket.IO, and Coturn together; the Pages website may still load but login/calls will fail.
- AWS compute, Elastic IP/public IPv4, and data transfer usage may consume credits or cost money. Check the Academy and AWS billing/usage screens. Do not assume the EC2 setup is permanently free or always on.
- Keep SSH restricted to your IP, keep the TURN relay ports only as required, and never publish private environment files or key material.

## References

- [DuckDNS free dynamic DNS](https://www.duckdns.org/)
- [AWS EC2 web server security-group ports](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html)
- [Caddy installation](https://caddyserver.com/docs/install)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Caddy reverse proxy and WebSockets](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [Expo web publishing](https://docs.expo.dev/guides/publishing-websites/)
- [Cloudflare Pages React deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [AWS public IPv4 information](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
