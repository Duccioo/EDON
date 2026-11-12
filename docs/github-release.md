# Publishing EDON on GitHub

This guide is for the first public release. The repository is <https://github.com/Duccioo/EDON>. No GitHub CLI or local Docker is required: GitHub Actions performs the release build.

## One-time GitHub settings

In the repository on GitHub, open **Settings** and configure:

1. **General → Repository name and description**: use the English description from `package.json`, add the topics `desktop`, `dashboard`, `local-first`, `markdown`, `obsidian`, `mcp`, `self-hosted`.
2. **Actions → General → Workflow permissions**: allow **Read and write permissions** so the release workflow can create a GitHub Release and publish the container image.
3. **Code security → Private vulnerability reporting**: enable it. The link in `SECURITY.md` and the issue form depends on it.
4. **Code security → Dependabot alerts** and **Dependabot security updates**: enable both.

After the first container image is published, open **Your profile → Packages → edon → Package settings** and:

- set package visibility to **Public** if anonymous users should pull the image;
- connect the package to the `EDON` repository.

## Before pushing

From the repository root on `main`:

```sh
npm ci
npm run build
npm test
npm run format:check
npx playwright install chromium
npm run test:e2e
docker build --tag edon:release-candidate .
```

`docker build` is optional locally because CI repeats it. All other checks must pass. Inspect `git status`: `.env`, `data/`, `test-results/` and personal vaults must never appear.

Confirm that the version is `0.1.0` in both `package.json` and `CHANGELOG.md`.

## Publish the source

```sh
git add -A
git commit -m "Release v0.1.0"
git push origin main
```

Wait for the **CI** workflow to pass on GitHub. If it fails, fix it before creating a tag.

## Create the release

The tag must exactly match `v` plus the version in `package.json` — for this release, `v0.1.0`.

```sh
git tag -a v0.1.0 -m "EDON v0.1.0"
git push origin v0.1.0
```

Pushing the tag starts **Actions → Release**. The workflow:

1. repeats the full CI suite;
2. checks that the tag and package version match;
3. builds `linux/amd64` and `linux/arm64` images;
4. publishes `ghcr.io/duccioo/edon:0.1.0`, `:0.1` and `:latest`;
5. creates the GitHub Release with generated notes and the image pull command.

Open the **Actions** tab and wait for a green Release workflow. Then check **Releases** and the package page.

## Verify the published result

```sh
docker pull ghcr.io/duccioo/edon:0.1.0
docker run --rm -p 127.0.0.1:3001:3001 -v edon-test:/app/data ghcr.io/duccioo/edon:0.1.0
```

Open <http://127.0.0.1:3001>, create a password and add one tile. Stop the container and remove the temporary volume when finished:

```sh
docker volume rm edon-test
```

## If something is wrong before publishing

Delete the local and remote tag, fix the problem, then create it again:

```sh
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0
```

If the Release workflow already created a public release, do not silently move the tag. Delete the release in the GitHub UI, publish a patch version instead, and document the issue.

## Later releases

1. Update the version in `package.json`, `package-lock.json` and the changelog.
2. Commit and push `main`.
3. Tag `vX.Y.Z` and push the tag.
4. Let the Release workflow publish the image and notes.

Follow semantic versioning: patch for compatible fixes, minor for compatible features, major for breaking changes.
