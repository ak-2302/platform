# Collaborative Open Music Web Site

The website is the public collaboration surface for creating and remixing open music.

## Core pages

- `/` — landing page for discovery and latest public jams.
- `/sessions/{sessionId}` — real-time collaboration room.
- `/tracks/{trackId}` — published track page with attribution and remix lineage.

## Data sources

The site consumes the HTTP API defined in `../contracts/openapi.yaml` and only renders user-generated rich text through the trusted renderer boundary documented in `../security/trusted-renderer-boundary.md`.
