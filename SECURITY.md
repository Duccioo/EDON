# Security policy

## Supported versions

Security fixes are prepared for the latest release. Older releases may require an upgrade before a fix can be applied.

## Reporting a vulnerability

Do **not** publish exploit details, passwords, tokens, vault contents or personal data in an issue or pull request.

Use **GitHub → Security → Report a vulnerability** to open a private security advisory:

<https://github.com/Duccioo/EDON/security/advisories/new>

Include:

- the affected version or commit and the environment;
- the impact and required preconditions;
- a minimal reproduction without real data;
- any known mitigation.

If private reporting is unavailable, open a contact request without technical details. Maintainers will coordinate analysis, a fix and disclosure. No fixed response time is promised.

## Current security boundaries

- Protect `data/desktop.sqlite`, `data/uploads/` and backups: they contain private data. Hermes keys saved through the UI are stored in plain text in SQLite.
- Password hashes use scrypt. Session and agent tokens are stored as hashes. `EDON_AGENT_TOKEN` and Hermes environment variables are deployment secrets.
- Bearer tokens are limited to tile/layout APIs and MCP. Vault reads are allowed for agents; vault configuration and direct note writes/deletions require an authenticated browser session.
- The Docker `/vault` mount is read/write: EDON can create, overwrite, rename and move Markdown files. Mount only the intended vault and keep independent backups.
- Do not expose EDON directly to the Internet. Use HTTPS or a VPN, set `COOKIE_SECURE=true` behind HTTPS and configure the password before exposing the service.
- Keep dependencies and GitHub Actions updated. An audit does not replace review of permissions, deployment and backups.

## Safe testing

Use a temporary data directory and a copy of any vault. Never run destructive tests against personal notes.
