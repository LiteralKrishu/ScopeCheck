# ScopeCheck release guide

The public release serves a self-contained browser app. It includes PDF extraction assets, examples, and local checks. The build needs no API key. Keep this production address stable so returning visitors can find their project records.

## Publish from GitHub

1. Import the ScopeCheck GitHub repository in Replit or pull the latest release into the existing project.
2. In **Publishing**, select **Static** and **Public**.
3. Set the public directory to `dist`.
4. Set the build command to `npm ci --omit=optional && npm test && npm run build`.
5. Publish. Open the resulting `.replit.app` URL in a fresh browser session.

The Replit workspace preview uses `npm start` on port 3000. Publish the static build for the public demo. [Replit deployment types](https://docs.replit.com/features/publishing/deployment-types)

## Verify the release

1. Confirm that `/release.json` reports the expected version.
2. Open the Harbor Studio example. Use the example message and check for a cited exclusion.
3. Record the decision, set draft terms, mark the request shared, and record a fictional approval.
4. Check that the change log lists the approval after reload. Export the evidence record.
5. Download and restore a project backup. Confirm that the copied project keeps its agreement evidence.
6. Try a two-page PDF and check that the second page can be cited. Verify the workflow at a narrow viewport.

## Restore a previous release

If the public smoke test fails, republish the last verified GitHub commit at the same public address. Browser data stays associated with that address. Keep backups before changing data formats or moving the site.
