# re:sonance — music collaboration platform

This workspace is a browser-first proof of concept for collaborative music projects built around GitHub's branch, pull request, and history model.

## Repository layout

The intended GitHub organization is split into three repositories:

```text
music-collab/
├── platform   # this web experience, API contracts, and renderer boundary
├── opendaw    # pinned openDAW fork with platform integration notes
└── song-demo  # one song per repository; project + manifest + credits
```

The current proof of concept is dependency-free at runtime so it can be opened directly as `index.html`. `src/main.jsx` contains the React implementation used when the Vite toolchain is available; `src/app.js` is the no-build demo entry used for local review in restricted environments.

## Proof-of-concept flow

The demo supports the product path visually: browse a song, play the preview, inspect proposals/history/files, and create a proposal that represents a GitHub PR. The actual GitHub App, D1/R2 persistence, and trusted renderer are intentionally represented by the UI boundary and should be wired behind the same actions in the next slice.
