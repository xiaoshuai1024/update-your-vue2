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

### Config file (root)

The CLI will auto-load `update-your-vue2.json` from the target project root.

Example config (migrate + install dependencies):

```json
{
  "target": "vite",
  "useCompat": false,
  "generateTypes": false,
  "backup": true,
  "backupDir": ".update-your-vue2/backups",
  "install": true
}
```

You can also point to a custom config file:

```bash
update-your-vue2 --config ./path/to/update-your-vue2.json
```

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
- `--install` is opt-in and runs after file changes apply

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

- **Skip default pre-backup**

```bash
update-your-vue2 restore --zip .update-your-vue2/backups/<backup>.zip --no-prebackup
```

## Fixture (for local verification)

The repo includes a minimal sample project at `playground/vue2-sample/` so you can quickly try:

```bash
node dist/cli.js playground/vue2-sample --dry-run
node dist/cli.js playground/vue2-sample --no-install
```

Expected after non-dry-run:
- `package.json` dependencies/scripts migrated and old scripts backed up at `updateYourVue2.backupScripts`
- `vite.config.ts` generated with alias/base defaults
- `src/main.js` transformed to `createApp(...).mount(...)` when pattern is safe

