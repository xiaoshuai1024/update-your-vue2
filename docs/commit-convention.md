# Commit Convention (Conventional Commits)

We use **Conventional Commits** so changes are easy to scan and can be used for release notes later.

## Format

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

### Types

Common types in this repo:

- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation only
- `refactor`: refactor without behavior change
- `test`: tests only
- `chore`: tooling / maintenance
- `ci`: CI changes
- `build`: build system changes
- `perf`: performance improvements
- `revert`: revert previous commit

### Scope

Use a short scope when it helps:

- `cli`, `backup`, `restore`, `deps`, `codemods`, `build`, `report`

### Breaking changes

Use `!` after scope (or after type) to indicate a breaking change:

```
feat(cli)!: change default target to vite
```

## Examples

```
feat(codemods): apply entry-point transform for createApp
fix(backup): respect backupDir ignore rules
docs: add contributing guide
ci: run tests on Node 18 and 20
```

