# Architecture

`platform` owns the site, API, and renderer boundary. A song repository owns the openDAW project, `song.json`, credits, license, and contribution rules. GitHub stores source and review history; object storage stores rendered previews and large audio assets.

The browser never receives GitHub App credentials. A trusted API creates a proposal branch from the recorded base SHA, commits the project, opens a PR, and asks a trusted renderer to produce A/B previews.
