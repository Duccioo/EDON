# Release policy

EDON uses the version in `package.json`, semantic version tags and the release notes in [`CHANGELOG.md`](../CHANGELOG.md). Publishing is automated by [`.github/workflows/release.yml`](../.github/workflows/release.yml) when a `v*.*.*` tag is pushed. The beginner-friendly procedure is in [github-release.md](github-release.md).

## Release gate

A release candidate is publishable only when:

- the version in `package.json`, the lockfile and `CHANGELOG.md` matches the tag;
- CI passes on Node 24: dependency audit, build, backend tests, formatting, Playwright and Docker build;
- authentication and authorization, vault writes, backups and delete/trash behavior have been reviewed if changed;
- no `.env`, database, upload, personal vault, token or local test artifact is tracked;
- README, `.env.example`, `NOTICE`, security notes and upgrade instructions describe the current behavior;
- the Docker image builds and a container starts with an empty temporary data volume.

For changes touching Obsidian or other user files, test against a copy. Verify permissions, symlink confinement, stale-version conflicts, trash behavior and an independent backup.

## Publication

A maintainer reviews the release candidate. Merging or pushing code does not create a release. The final action is pushing an annotated tag:

```sh
git tag -a vX.Y.Z -m "EDON vX.Y.Z"
git push origin vX.Y.Z
```

The workflow verifies the tag, publishes the multi-architecture image to `ghcr.io/duccioo/edon`, and creates the GitHub Release. Never move a published tag; publish a new patch release instead.

## Rollback and security

- Keep a database and vault backup from before the upgrade.
- Record known issues and workarounds in the changelog or GitHub issues.
- If a published release contains a vulnerability, publish a fixed patch and follow coordinated disclosure. Do not put exploit details in a public issue.

## After publication

Check the GitHub Release, GHCR image, image visibility and install instructions. Keep the previous release available for rollback and document any manual migration.
