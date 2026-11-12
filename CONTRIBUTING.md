# Contributing to EDON

## Setup

Use Node.js 24+ and npm:

```sh
npm ci
npm run dev
```

Do not commit `.env*` files, databases, uploads, personal vaults, tokens or test output. `.env.example` is the only tracked environment template.

## Making changes

- Keep changes small and consistent with the existing structure. Add a dependency only when it solves a concrete problem.
- Add or update tests for fixes and features. Do not weaken existing tests to hide a regression.
- Update documentation and the changelog when behavior, configuration, security, backup or release procedures change.
- Never run destructive examples against a real vault. Use a temporary directory or a copy.

## Required checks

```sh
npm run build
npm test
npm run format:check
npx playwright install chromium
npm run test:e2e
```

For Dockerfile or Compose changes, also run `docker build .` and test Compose with temporary data where relevant. State which commands actually ran and which tests were not run. Do not claim a verification passed only because the code changed.

## Security and licensing

Do not open public issues containing exploitable details or private data. Follow [SECURITY.md](SECURITY.md). By contributing, you agree that your work is distributed under the [MIT License](LICENSE). For new assets, document the source and license in [NOTICE](NOTICE); do not add material with unverified redistribution rights.

For releases, follow [the GitHub release guide](docs/github-release.md) and [release policy](docs/release.md).
