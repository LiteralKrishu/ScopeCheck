# ScopeCheck

ScopeCheck is a change-control workspace. It links a request to the agreed scope, shows exact agreement quotes, and records the decision and any written approval. It works in a browser without an account.

## Try a workflow

- **Fixed-price development.** Check an added feature against the signed statement of work. Prepare a priced change request and record the client's response.
- **Creative and agency work.** Check added deliverables and revision rounds against the creative brief. Keep a record when the client approves new work.
- **Internal change control.** Check a stakeholder request against a rollout plan or service agreement. Record the schedule impact and written sign-off.

Open **Data & examples** to try each workflow with fictional data.

## Review a request

1. Add a PDF with selectable text, a UTF-8 TXT file, or pasted agreement text.
2. Review the extracted clauses. Set each category and keep the exact quotes you need.
3. Paste a message or import a UTF-8 TXT excerpt. Enter the channel and date.
4. Check the request. Read the evidence and record **In scope**, **Out of scope**, or **Unclear**. Add a follow-up to an unclear decision when you get more information.
5. For an out-of-scope decision, set the time impact and price. Review and download the change request.
6. Share it through your usual channel. Mark it shared and record the written approval or decline.

The change log supports search and status filters. Export an evidence record to keep the original message, agreement version, exact quotes, review history, and written response together. A new agreement version applies to new checks.

## Data and checks

The public app processes agreements and requests in the browser. Each browser and site address has its own project records. Use **Data & examples** to download a project backup before clearing browser data or moving to another browser. Restore creates a separate copy and checks the agreement references. Backups contain readable project data.

The local checker suggests a verdict when it finds explicit matching scope language. It sends ambiguous or mixed requests to review. A person confirms every decision.

For optional AI checks in a local installation, copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and restart. Select **Use AI for this request** to send that message and the reviewed quotes to OpenAI. ScopeCheck validates the returned citation IDs and displays exact quotes from the agreement. [Responses API](https://platform.openai.com/docs/api-reference/responses)

Agreements support up to 50 PDF pages, 100,000 characters, and 100 reviewed clauses. Uploads can be up to 8 MB. Requests and responses can contain up to 8,000 characters. For scanned or locked PDFs, paste verified text. [PDF.js](https://mozilla.github.io/pdf.js/)

## Run and verify

Use Node.js 22.13 or later.

```sh
npm ci --omit=optional
npm test
npm start
```

Open [the local workspace](http://127.0.0.1:3000). Run `npm run build` to generate the public website in `dist/`.

See the [release guide](docs/release.md) and [pilot plan](docs/build-plan.md).
