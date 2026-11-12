# Changelog

All notable changes are documented here. The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses semantic versioning for releases.

## [Unreleased]

### Fixed

- Prevented duplicate Vault files when a desktop save completes while another local edit is waiting; the client now adopts server-assigned `vaultPath`/`vaultVersion` and the server reuses an existing path for stale snapshots.
- Enforced the documented read-only Vault boundary for Bearer agents: tile APIs cannot create or edit notes/todos while a Vault is active, nor link, overwrite or trash Vault files. Agent operations no longer trigger an implicit Vault sync.
- A note renamed or deleted outside EDON is no longer recreated at its old path. Unrelated desktop saves still succeed; editing the missing note returns a clear conflict.
- Rejected duplicate tiles pointing to the same Vault file before any filesystem write, preventing partial saves.
- Seed titles no longer contain line breaks that would be lost when exported as Markdown headings.
- Made the responsive tile-layout browser test wait for stable layout instead of reading geometry mid-transition.
- Removed the manual release dispatch path, which could verify a different commit from the tag.

### Added

- Nine regression tests covering Vault save races, agent write denial, missing external notes, duplicate links, snapshot merging, folder children, seed titles and a real-browser Vault flow with the polling interval.

## [0.1.0] - 2026-11-12

### Added

- Local-first tile desktop with notes, todos, links, images, files, clocks, folders, weather, timers, system metrics, AI quotas and radio.
- Markdown editing, quick capture, configurable grid, folders, archive, backups and appearance presets.
- Optional two-way Obsidian vault integration with browse, search, pinning, note editing and trash handling.
- Scoped Bearer tokens, agent REST API and stateless MCP endpoint.
- MIT license, asset provenance, contribution, security and release documentation.
- GitHub CI on Node 24 with dependency audit, build, tests, formatting, Playwright and Docker build.
- Automated GitHub release workflow publishing multi-architecture images to GHCR.
- Optional Compose override for mounting a host vault at `/vault`.
- Issue forms, pull request checklist and Dependabot updates.

### Changed

- Hardened vault access with read-only agent tokens, file version checks, confined paths and atomic writes. Notes that cannot be represented losslessly are never overwritten.
- Fixed frontend race conditions, cross-tile edits, folder vault links and compact side workspaces.
- Improved the desktop with quiet empty-cell guides, paper-like note workspaces, a unified command bar and visible save status.
- Updated dependencies, including Zod 4; `npm audit` reports no known vulnerabilities.
- Playwright uses its managed Chromium when `CHROME_PATH` is not set.
- `.env*` files remain excluded from Git and Docker builds, except `.env.example`.

[Unreleased]: https://github.com/Duccioo/EDON/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Duccioo/EDON/releases/tag/v0.1.0
