# AST Migration (v1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AST-based codemod pipeline so .js/.ts/.jsx/.tsx and .vue script blocks are transformed with parse → AST rules → print; on parse failure or when a rule has no AST implementation, fall back to existing string codemods. First AST rule: `new Vue({ render }).$mount` → `createApp(App).mount`. Include .vue SFC support (extract script, run AST, reassemble) and ChangeQueue preflight + execution log with stop-on-failure and restore hint.

**Architecture:** New layer under `src/migrate/ast/` (parse, print, types, AstCodemod contract). Runner decides per file: if extension is AST-supported, try parse → run AST codemods → print; on parse error or rule without AST, run string codemods on original content. Result shape stays `RunCodemodsResult` so CLI keeps pushing edits into ChangeQueue. ChangeQueue gets preflight (e.g. no duplicate path writes) and apply() logs each change, stops on first failure, and suggests restore.

**Tech Stack:** @babel/parser (JS/TS/JSX/TSX), recast (print with Babel parser), @vue/compiler-sfc (SFC parse/serialize), existing string codemods as fallback.

---

## Task 1: Dependencies and AST types

**Files:**
- Modify: [package.json](package.json)
- Create: [src/migrate/ast/types.ts](src/migrate/ast/types.ts)
- Test: [src/migrate/ast/types.test.ts](src/migrate/ast/types.test.ts) (optional; types only)

**Step 1: Add dependencies**

Add to `package.json` dependencies (or devDependencies if only used at build/migrate time; for a CLI that runs migration, these are runtime):

- `@babel/parser` (parse JS/TS/JSX/TSX)
- `recast` (print; use with babel parser option)
- `@vue/compiler-sfc` (parse/serialize .vue SFC)

Run: `npm install @babel/parser recast @vue/compiler-sfc`

**Step 2: Create AST types and AstCodemod contract**

In [src/migrate/ast/types.ts](src/migrate/ast/types.ts) define:

- `AstCodemodContext`: `{ projectRoot: string }` (align with existing CodemodContext).
- `AstCodemodInput`: `{ filePath: string; ast: File; source: string; ctx: AstCodemodContext }`. Use `File` from `@babel/types` (or the AST type returned by your parser).
- `AstCodemodResult`: `{ ast?: File; notes: CodemodNote[] }`. If `ast` is present, runner will print it and use as new content; otherwise only notes (no change).
- `AstCodemod`: `{ name: string; run: (input: AstCodemodInput) => AstCodemodResult }`.

Re-export or import `CodemodNote` from [src/migrate/codemods/types.ts](src/migrate/codemods/types.ts) so notes stay consistent.

**Step 3: Commit**

```bash
git add package.json package-lock.json src/migrate/ast/types.ts
git commit -m "chore: add AST deps and ast/types with AstCodemod contract"
```

---

## Task 2: Parse and print (AST infra)

**Files:**
- Create: [src/migrate/ast/parse.ts](src/migrate/ast/parse.ts)
- Create: [src/migrate/ast/print.ts](src/migrate/ast/print.ts)
- Test: [src/migrate/ast/parse.test.ts](src/migrate/ast/parse.test.ts)
- Test: [src/migrate/ast/print.test.ts](src/migrate/ast/print.test.ts)

**Step 1: Write failing tests for parse**

In [src/migrate/ast/parse.test.ts](src/migrate/ast/parse.test.ts): `parseScript(source, filePath)` returns AST for valid JS; throws or returns error for invalid JS. Use a simple string like `"const x = 1;"` and assert the returned node type (e.g. File or Program).

**Step 2: Run test to verify it fails**

Run: `npm test -- src/migrate/ast/parse.test.ts`
Expected: FAIL (parseScript not defined or missing module).

**Step 3: Implement parse**

In [src/migrate/ast/parse.ts](src/migrate/ast/parse.ts): `parseScript(source: string, filePath: string): File` using `@babel/parser` with `sourceType: "module"`, `plugins: ["jsx", "typescript"]` as needed based on extension (.ts/.tsx). Export a single function used by the runner. Use `@babel/types` `File` type if applicable.

**Step 4: Run parse test**

Run: `npm test -- src/migrate/ast/parse.test.ts`
Expected: PASS.

**Step 5: Write failing tests for print**

In [src/migrate/ast/print.test.ts](src/migrate/ast/print.test.ts): `print(ast)` returns a string; round-trip parse(print(ast)) is equivalent (or print preserves key content).

**Step 6: Run print test to verify it fails**

Run: `npm test -- src/migrate/ast/print.test.ts`
Expected: FAIL.

**Step 7: Implement print**

In [src/migrate/ast/print.ts](src/migrate/ast/print.ts): use `recast` with parser option set to `@babel/parser` so it accepts Babel AST (recast.print(ast) or equivalent API). Return string.

**Step 8: Run print test**

Run: `npm test -- src/migrate/ast/print.test.ts`
Expected: PASS.

**Step 9: Commit**

```bash
git add src/migrate/ast/parse.ts src/migrate/ast/print.ts src/migrate/ast/parse.test.ts src/migrate/ast/print.test.ts
git commit -m "feat(ast): add parse and print with tests"
```

---

## Task 3: Runner AST branch and fallback

**Files:**
- Modify: [src/migrate/codemods/runner.ts](src/migrate/codemods/runner.ts)
- Test: [src/migrate/codemods/runner.test.ts](src/migrate/codemods/runner.test.ts)

**Step 1: Define AST-supported extensions and default AST codemods list**

In [src/migrate/codemods/runner.ts](src/migrate/codemods/runner.ts): add constant `AST_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"]` and accept optional `astCodemods: AstCodemod[]` in options (default empty array for this task so behavior unchanged).

**Step 2: Add AST-first branch per file**

For each file with extension in `AST_EXTENSIONS`: try `parseScript(content, filePath)`. On success: run each `astCodemod.run({ filePath, ast, source: content, ctx })`; if any returns `ast`, use the last one and call `print(ast)` to get `newContent`, then push edit and skip string codemods for this file. On parse throw: push notes (e.g. "Parse failed, skipped AST") and run existing string codemods on original content. If no AST codemod returns `ast`, run string codemods on original content.

**Step 3: Keep RunCodemodsResult shape**

Still return `{ edits, notes, filesScanned }`. Edits come from either AST path or string path.

**Step 4: Add test for fallback**

In [src/migrate/codemods/runner.test.ts](src/migrate/codemods/runner.test.ts): add a test that when `astCodemods` is empty, behavior matches current (e.g. transformNewVueMount string codemod still runs and produces edits). Add a test that invalid JS in a .js file produces a note and still runs string codemods (fallback).

**Step 5: Run tests**

Run: `npm test -- src/migrate/codemods/runner.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/migrate/codemods/runner.ts src/migrate/codemods/runner.test.ts
git commit -m "feat(codemods): runner AST branch with fallback to string codemods"
```

---

## Task 4: AST rule transformNewVueMount (new Vue → createApp)

**Files:**
- Create: [src/migrate/ast/rules/transformNewVueMountAst.ts](src/migrate/ast/rules/transformNewVueMountAst.ts)
- Test: [src/migrate/ast/rules/transformNewVueMountAst.test.ts](src/migrate/ast/rules/transformNewVueMountAst.test.ts)
- Modify: [src/migrate/codemods/index.ts](src/migrate/codemods/index.ts) or runner registration to pass AST codemods

**Step 1: Write failing tests for AST rule**

In [src/migrate/ast/rules/transformNewVueMountAst.test.ts](src/migrate/ast/rules/transformNewVueMountAst.test.ts): given source `import Vue from "vue"; new Vue({ render: h => h(App) }).$mount("#app");`, run the AST codemod, assert output contains `createApp(App).mount("#app")` and no `new Vue`, and import is `createApp` from "vue". Add case where Vue is still used elsewhere and rule only adds notes (no ast).

**Step 2: Run test to verify it fails**

Run: `npm test -- src/migrate/ast/rules/transformNewVueMountAst.test.ts`
Expected: FAIL.

**Step 3: Implement AST rule**

In [src/migrate/ast/rules/transformNewVueMountAst.ts](src/migrate/ast/rules/transformNewVueMountAst.ts): use @babel/traverse (or recast.visit) to find `NewExpression` with callee name "Vue" and a subsequent `.$mount(...)` call (MemberExpression + CallExpression). Replace with `createApp(Component).mount(selector)`. Update imports: ensure `createApp` from "vue"; remove default Vue if no longer referenced. Return `{ ast, notes }` when transformed; `{ notes }` when Vue still referenced or pattern not matched. Export as `transformNewVueMountAst` satisfying `AstCodemod`.

**Step 4: Run test**

Run: `npm test -- src/migrate/ast/rules/transformNewVueMountAst.test.ts`
Expected: PASS.

**Step 5: Register AST codemod in runner**

In [src/migrate/codemods/index.ts](src/migrate/codemods/index.ts) (or runner options at CLI): export `DEFAULT_AST_CODEMODS = [transformNewVueMountAst]`. In [src/cli.ts](src/cli.ts) where `runCodemods` is called, pass `astCodemods: DEFAULT_AST_CODEMODS` so runner uses AST first for supported extensions.

**Step 6: Run full test suite**

Run: `npm test`
Expected: PASS.

**Step 7: Commit**

```bash
git add src/migrate/ast/rules/transformNewVueMountAst.ts src/migrate/ast/rules/transformNewVueMountAst.test.ts src/migrate/codemods/index.ts src/cli.ts
git commit -m "feat(ast): add AST transformNewVueMount and register in runner"
```

---

## Task 5: .vue SFC support (extract script → AST → reassemble)

**Files:**
- Create: [src/migrate/ast/sfc.ts](src/migrate/ast/sfc.ts)
- Test: [src/migrate/ast/sfc.test.ts](src/migrate/ast/sfc.test.ts)
- Modify: [src/migrate/codemods/runner.ts](src/migrate/codemods/runner.ts)

**Step 1: Write failing tests for SFC**

In [src/migrate/ast/sfc.test.ts](src/migrate/ast/sfc.test.ts): `extractScriptContent(sfcSource)` returns script content and lang; `reassembleSfc(descriptor, newScriptContent)` returns full SFC string. Use a minimal .vue string with `<script>const x = 1;</script>` and template/style.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/migrate/ast/sfc.test.ts`
Expected: FAIL.

**Step 3: Implement SFC helpers**

In [src/migrate/ast/sfc.ts](src/migrate/ast/sfc.ts): use `@vue/compiler-sfc` `parse` to get descriptor; export `extractScriptContent(descriptor)` (first script block content and lang); export `reassembleSfc(descriptor, newScriptContent)` that rebuilds raw source (or use compiler-sfc serialize if available). Handle no script block (return original or empty).

**Step 4: Run SFC test**

Run: `npm test -- src/migrate/ast/sfc.test.ts`
Expected: PASS.

**Step 5: Integrate .vue in runner**

In [src/migrate/codemods/runner.ts](src/migrate/codemods/runner.ts): for `.vue` files, parse SFC; get script content; if present, run same AST pipeline (parse script → AST codemods → print); then reassemble SFC with new script content and push one edit for the .vue file. On script parse failure, fall back to string codemods on full file content. Template and style blocks unchanged.

**Step 6: Add runner test for .vue**

Add test: .vue file with `new Vue({ render: h => h(App) }).$mount("#app")` in script gets transformed to createApp/mount and SFC structure preserved.

**Step 7: Run tests**

Run: `npm test`
Expected: PASS.

**Step 8: Commit**

```bash
git add src/migrate/ast/sfc.ts src/migrate/ast/sfc.test.ts src/migrate/codemods/runner.ts src/migrate/codemods/runner.test.ts
git commit -m "feat(ast): .vue SFC extract script, AST pipeline, reassemble"
```

---

## Task 6: ChangeQueue preflight and execution log

**Files:**
- Create: [src/changes/changeQueue.test.ts](src/changes/changeQueue.test.ts)
- Modify: [src/changes/changeQueue.ts](src/changes/changeQueue.ts)
- Modify: [src/cli.ts](src/cli.ts)

**Step 1: Write failing tests for preflight**

In [src/changes/changeQueue.test.ts](src/changes/changeQueue.test.ts): `preflight()` returns success when no duplicate paths; returns error or throws when same path is written twice (e.g. two writeFile for same path). Optionally: duplicate updateJson path also fails preflight.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/changes/changeQueue.test.ts`
Expected: FAIL (preflight not implemented or test file missing).

**Step 3: Implement preflight**

In [src/changes/changeQueue.ts](src/changes/changeQueue.ts): add `preflight(): { ok: true } | { ok: false; reason: string }` that checks for duplicate `path` in changes (e.g. two writeFile or two updateJson on same path). Call preflight before apply in CLI (or inside apply); document that apply should not run if preflight fails.

**Step 4: Run preflight test**

Run: `npm test -- src/changes/changeQueue.test.ts`
Expected: PASS.

**Step 5: Add execution log and stop-on-failure**

In [src/changes/changeQueue.ts](src/changes/changeQueue.ts): during `apply()`, log each change (path + kind) before applying; on any failure (writeFile/updateJson/mkdir throws), catch, log "Apply failed at ...", and suggest "Run with --restore to restore from backup". Stop applying remaining changes after first failure. Optionally return a result object `{ applied: number; failed?: { path; error } }` for caller.

**Step 6: Call preflight in CLI before apply**

In [src/cli.ts](src/cli.ts): before `queue.apply()`, call `queue.preflight()`; if not ok, exit with error and do not apply.

**Step 7: Run tests**

Run: `npm test`
Expected: PASS.

**Step 8: Commit**

```bash
git add src/changes/changeQueue.ts src/changes/changeQueue.test.ts src/cli.ts
git commit -m "feat(changes): preflight duplicate paths, apply log and stop on first failure"
```

---

## Task 7: Docs and registration docs

**Files:**
- Create or modify: [docs/plans/2026-03-19-ast-migration-v1.md](docs/plans/2026-03-19-ast-migration-v1.md) (this plan)
- Create: [docs/adding-codemod-rules.md](docs/adding-codemod-rules.md) or add section to existing docs

**Step 1: Document how to add AST vs string rules**

In [docs/adding-codemod-rules.md](docs/adding-codemod-rules.md): explain AstCodemod contract (input ast/source/ctx, output ast/notes); where to register (`DEFAULT_AST_CODEMODS` vs `DEFAULT_CODEMODS`); that runner runs AST first for .js/.ts/.jsx/.tsx and .vue script, then fallback to string codemods. One short example of a minimal AST rule and a minimal string rule.

**Step 2: Commit**

```bash
git add docs/adding-codemod-rules.md
git commit -m "docs: how to add AST and string codemod rules"
```

---

## Execution summary

| Order | Task | Key deliverable |
|-------|------|------------------|
| 1 | Deps + types | package.json deps, AstCodemod in src/migrate/ast/types.ts |
| 2 | Parse/print | parse.ts, print.ts + tests |
| 3 | Runner AST + fallback | runner.ts AST branch, fallback to string codemods |
| 4 | AST transformNewVueMount | transformNewVueMountAst.ts + tests, registered |
| 5 | .vue SFC | sfc.ts extract/reassemble, runner .vue path |
| 6 | ChangeQueue preflight + log | preflight(), apply() log and stop-on-failure |
| 7 | Docs | docs/adding-codemod-rules.md |

---

## Execution options

Plan complete and saved to `docs/plans/2026-03-19-ast-migration-v1.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — Open a new session with executing-plans, batch execution with checkpoints.

Which approach?
