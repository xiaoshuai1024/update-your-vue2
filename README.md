# update-your-vue2

Node.js CLI to upgrade Vue 2 projects to Vue 3 (MVP scaffold).

## Install / Run

- **Local dev**

```bash
npm i
npm run build
node dist/cli.js --help
```

- **Global (development)**

```bash
npm link
update-your-vue2 --help
```

## Migrate a project (MVP)

- **Dry run (recommended first)**

```bash
update-your-vue2 --dry-run
```

- **Also supported (alias):**

```bash
update-your-vue2 dry-run
```

- **Run (creates backup zip, updates package.json, writes migration-report.md)**

```bash
update-your-vue2 --no-install
```

Notes:
- Default backup output: `.update-your-vue2/backups/*.zip`
- Default build target: `vite` (generates `vite.config.ts`)

## Restore from a backup zip

- **Interactive selection**

```bash
update-your-vue2 restore
```

- **Restore a specific zip**

```bash
update-your-vue2 restore --zip .update-your-vue2/backups/<backup>.zip
```

- **Dry run**

```bash
update-your-vue2 restore --zip .update-your-vue2/backups/<backup>.zip --dry-run
```

## Fixture (for local verification)

The repo includes a minimal sample project at `fixtures/vue2-sample/` so you can quickly try:

```bash
node dist/cli.js fixtures/vue2-sample --dry-run
node dist/cli.js fixtures/vue2-sample --no-install
```

