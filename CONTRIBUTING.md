# Contributing

Thanks for your interest in contributing to `update-your-vue2`.

## Quick start

### Prerequisites

- Node.js >= 18
- npm (CI uses `npm ci`)

### Install, test, build

```bash
npm i
npm test
npm run build
```

## Development workflow

### Run the CLI locally

```bash
npm run build
node dist/cli.js --help
```

### Fixture (local verification)

We keep a small fixture project in `fixtures/vue2-sample/` for fast iteration:

```bash
node dist/cli.js fixtures/vue2-sample --dry-run
node dist/cli.js fixtures/vue2-sample --no-install
```

### Unit tests

- Test runner: Vitest
- Naming: `src/**/*.test.ts`

```bash
npm test
```

## Adding / updating a codemod

Codemods live under:

- `src/migrate/codemods/`

Guidelines:

- Prefer **safe, narrowly-scoped transforms** over aggressive rewrites.
- If a transform is uncertain, emit a **note** (so the report can guide manual fixes).
- Add/adjust tests for each new rule.

## Pull requests

Before opening a PR:

- Ensure `npm test` passes
- Ensure `npm run build` passes
- Keep changes focused (small PRs are easier to review)

CI will run:

- `npm ci`
- `npm test`
- `npm run build`

## Commit messages

This repo uses **Conventional Commits**. See `docs/commit-convention.md`.

