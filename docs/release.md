# ScopeCheck release guide

## Configure the production service

1. Use a Node.js host that supports Next.js server routes. Set the build command to `npm ci && npm run build` and the start command to `npm start`.
2. Set `AUTH_URL` to the public HTTPS origin. Generate a unique `AUTH_SECRET` with `openssl rand -base64 32`. Keep all credentials in the host's secret settings.
3. Set `REDIS_URL` to a dedicated Redis 6.2 or later instance. Use TLS for remote connections, turn on persistence and backups, and set the eviction policy to `noeviction`.
4. Configure Google OAuth. Register the production origin with `/api/auth/callback/google` appended as an authorized redirect URI. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
5. To enable email sign-in, set `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM`. Verify the sender domain in Resend.
6. Set `OPENAI_API_KEY` only if the deployment should offer AI checks.
7. Configure the proxy to accept JSON backup uploads up to 16 MB. Set request and rate limits at the proxy for public traffic. Keep workspace and authentication responses out of shared caches.

Use Redis as a durable data store and verify that you can restore its backups. Keep the database on a private network where the host supports it. [Redis persistence](https://redis.io/docs/latest/management/persistence/)

For Replit, use the Autoscale deployment in `.replit` and set the same secrets in the deployment. A host that sets a lower request size limit will also limit backup imports. [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)

## Move from the browser-only version

Before replacing the old release, download each project backup from the original browser and site address. After deployment, sign in and restore each file in **Data and examples**.

## Verify the release

1. Check that `/api/health` returns HTTP 200 and `{"status":"ready"}`.
2. Sign in with Google. If email sign-in is enabled, request and open a test link. Verify that the link works once and that signing out closes workspace access.
3. Open the website example. Check a request, confirm the cited exclusion, and record an out-of-scope decision. Prepare and share a fictional change request, then record a written approval.
4. Sign in from a separate browser and verify the change log and evidence export. Check that a different account cannot access the project.
5. Download and restore a backup. Confirm that the copied project keeps its exact quotes and review history. Try a PDF and verify its page references.
6. Install the app in a supported browser. Disconnect and open it. Verify that it shows a reconnect screen. Reconnect and open the workspace.

## Restore a previous release

Keep a Redis backup and the previous server build before deploying. If a release fails, redeploy the last verified server build with the same Redis connection and authentication secret. Restore the database from a backup only if the data needs recovery.
