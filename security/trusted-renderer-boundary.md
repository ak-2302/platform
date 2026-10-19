# Trusted Renderer Boundary

All user-authored rich content (session notes, comments, markdown descriptions, lyric snippets) is **untrusted input**.

## Boundary rule

Only the trusted renderer may convert untrusted content into HTML displayed by the website. API and persistence layers store source text and never store pre-rendered HTML from users.

## Required controls

1. Parse input with an allow-list renderer (no raw HTML passthrough).
2. Sanitize output HTML with an allow-list policy for tags, attributes, and URL schemes.
3. Escape all text interpolations by default.
4. Block scriptable URL schemes (`javascript:`, `data:` except explicitly allowed media MIME types).
5. Apply CSP in website responses to reduce XSS impact.

## API contract tie-in

The API in `../contracts/openapi.yaml` accepts text payloads as plain strings/objects. Rendering is performed only at the trusted boundary in website runtime.
