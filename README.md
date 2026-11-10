# ScopeCheck

ScopeCheck is a change-control workspace. It checks client requests against a reviewed agreement and keeps the original message, exact agreement quotes, decisions, and written approvals together.

## Run locally

Use Node.js 22.13 or later and Redis 6.2 or later.

```sh
npm ci
cp .env.example .env.local
openssl rand -base64 32
docker run --rm --name scopecheck-redis -p 127.0.0.1:6379:6379 \
  -v scopecheck-redis:/data redis:7.4-alpine redis-server --appendonly yes
```

Set `AUTH_SECRET` in `.env.local` to the generated value. Set `REDIS_URL` if Redis uses a different address. Configure at least one sign-in method.

- **Google.** Create an OAuth web client. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. ScopeCheck accepts verified Gmail and Google Workspace addresses.
- **Email link.** Set `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM` to a Resend key and a sender on a verified domain. Each link expires after 15 minutes and works once.

Start the app in a separate terminal with `npm run dev`. Open [ScopeCheck](http://localhost:3000). Use the same address for `AUTH_URL` and in the browser. If you signed up by email, sign in and use **Account → Connect Google** to add Google to the same account.

## Review a request

1. Create a project. Upload a PDF with selectable text, upload a UTF-8 TXT file, or paste the agreement.
2. Review the extracted clauses and save the agreement version.
3. Paste the client message or import a TXT excerpt. Set its channel and date.
4. Check the request and review the cited clauses. Record **In scope**, **Out of scope**, or **Unclear**.
5. For an out-of-scope decision, prepare a change request with the time impact and price. Share the draft through your usual channel. Record the written approval or decline.

Use **Change log** to find requests and **Export evidence** to download a record. Use **Data and examples** to open fictional projects or download and restore backups.

## Project data

Redis stores project records and sign-in sessions. Each account has a private workspace. The browser uses an HTTP-only cookie to identify the session.

The app can be installed from a supported browser. On iOS, use Safari’s **Share → Add to Home Screen**. Project access and updates require a connection. When the app is offline, it shows a reconnect screen.

To bring projects from the old version, open that version in the original browser and download each project backup. Sign in to the new app and restore the files in **Data and examples**. Backups contain readable project data. Store them somewhere private.

The built-in checker looks for explicit scope language. A person confirms every decision. To enable optional AI checks, set `OPENAI_API_KEY`. ScopeCheck sends the current request and reviewed clauses to OpenAI only when the user selects the AI option for that request.

## Verify and deploy

Run `npm test` and `npm run build`. Set `SCOPE_CHECK_TEST_REDIS_URL` to a test instance to include Redis integration tests. Run `npm start` to serve the production build.

See the [release guide](docs/release.md) for deployment and verification steps.
