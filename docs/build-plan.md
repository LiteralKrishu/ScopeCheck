# ScopeCheck MVP plan

ScopeCheck helps fixed-price web developers review a client request against a signed agreement. The pilot tests whether keeping the original message, agreement evidence, and written approval together makes change requests easier to handle.

## Scope

- Create projects and review clauses from a PDF or text agreement.
- Capture a pasted request or a plain-text message excerpt with its channel and date.
- Present a provisional scope result and exact quotes from the reviewed agreement.
- Record a human decision. Prepare a change request, review its terms, and log the client's written response.
- Keep each project in one browser. Offer an optional AI check with explicit consent per request.

## Build sequence

1. Define agreement versions, source-linked clauses, and the request record.
2. Add browser storage and a fictional project for demonstrations.
3. Extract PDF and text clauses. Require review before use.
4. Add local evidence lookup and an optional three-way AI assessment. Verify citation IDs in code.
5. Add human decisions, change request drafts, export, and approval history.
6. Verify the complete workflow, including invalid input, stale agreement versions, and unsupported AI results.
7. Run consent-based pilots. Compare time to a reviewed draft, the number of drafts shared, and written approvals. Count added revenue only when a charge is confirmed.

## Research and validation

Requirements changes are documented in software projects. Local frequency, revenue loss, and willingness to pay among independent developers remain open. The pilot hypothesis concerns how developers use message excerpts and approval evidence in their own work. [Requirements change study](https://arxiv.org/abs/2012.03423)

Established workflows record impact, review status, and client sign-off as distinct fields. ScopeCheck keeps those steps separate and asks the developer to supply the price and time impact. [Change request workflow](https://support.scoro.com/hc/en-us/articles/49603465617421-Change-Request-Log-app)

Interview 10 developers about recent fixed-price projects. With consent, collect at least 60 agreement and request pairs and ask two people to label them independently. Measure out-of-scope precision, missed changes, and how often the checker returns unclear. A pilot target is 90% out-of-scope precision with zero invented citations. Track whether five pilot users share drafts and record written approvals. These are proposed tests and targets.
