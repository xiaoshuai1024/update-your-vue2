# Releasing

This repo uses **semantic-release** to publish to npm and generate `CHANGELOG.md` automatically.

## Versioning

Use semantic versioning:

- `MAJOR`: breaking changes
- `MINOR`: new features (backward compatible)
- `PATCH`: bug fixes

## Pre-release checklist

Run locally:

```bash
npm test
npm run build
```

## Conventional Commits -> Releases

Releases are determined from commit messages on `master`:

- `fix:` → patch
- `feat:` → minor
- `feat!:` / `fix!:` or `BREAKING CHANGE:` → major

## CI Release (GitHub Actions)

Workflow: `.github/workflows/release.yml`

Triggers:

- push to `master`
- manual `workflow_dispatch`

Trusted Publishing prerequisites (npm):

- In npm package settings, add a Trusted Publisher for this GitHub repo/workflow.
- Workflow must have `permissions.id-token: write`.
- No `NPM_TOKEN` secret is required.

GitHub auth:

- `GITHUB_TOKEN` (built-in) is used by semantic-release for GitHub release/changelog operations.

What it does:

- `npm ci`
- `npm test`
- `npm run build`
- `npm run release` (semantic-release with npm trusted publishing + provenance)

Outputs:

- Publishes to npm
- Creates a GitHub Release
- Updates `CHANGELOG.md` and commits it back to `master`

## Prevent direct pushes to master

In GitHub branch protection rules for `master`, enable:

- Require a pull request before merging
- Restrict who can push to matching branches
- (Recommended) Require status checks to pass before merging (CI)

This ensures releases only happen from trusted pushes to `master`.

