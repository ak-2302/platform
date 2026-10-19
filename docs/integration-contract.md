# re:sonance integration contract

## Browser ↔ openDAW

The platform sends same-origin `postMessage` events with these types:

- `resonance:open-project`: `{ songId, path, engineCommit }`
- `resonance:request-project-snapshot`: `{ songId }`

openDAW returns `{ type: "resonance:project-snapshot", songId, snapshotId,
snapshot }` to the same origin. The platform ignores messages from any other
origin and rejects empty snapshots or responses that exceed the timeout.

The production adapter must validate `event.origin`, pin the engine commit from `song.json`, and return a project snapshot without exposing GitHub credentials.

## Proposal API boundary

The current `src/platformApi.js` is a local adapter for the MVP UI. Its functions map directly to the production API:

- `listProposals()` → `GET /api/songs/:songId/proposals`
- `listFiles()` → `GET /api/songs/:songId/files`
- `listCommits()` → `GET /api/songs/:songId/commits`
- `createProposal()` → `POST /api/songs/:songId/proposals`
- `openProject()` / `requestProjectSnapshot()` → openDAW bridge

Rendering is exposed as `POST /api/songs/night-transit/proposals/:id/render` and `GET /api/renders/:jobId`. The server rejects proposals whose base SHA does not match the pinned manifest and returns only the fixed renderer version and preview URLs.

GitHub credentials are server-only environment variables. The webhook endpoint requires an `x-hub-signature-256` HMAC generated with `GITHUB_WEBHOOK_SECRET`; invalid signatures are rejected before event processing.

The server owns base SHA lookup, branch creation, commit creation, PR creation, webhook verification, render authorization, and object-storage URLs.

## Trusted render invariant

Only the configured openDAW commit and renderer version may run. The renderer must check base/head SHAs before reading a proposal and must never execute workflows, scripts, or dependencies from the proposal repository.
