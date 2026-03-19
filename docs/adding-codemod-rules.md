# Adding Codemod Rules

This project supports two codemod layers:

- **AST codemods** (preferred): parse source to AST, transform safely, print back to code.
- **String codemods** (fallback): regex/string based transforms and notes.

Runner behavior:

- For `.js/.jsx/.ts/.tsx`: try AST codemods first.
- For `.vue`: parse SFC, run AST codemods on `<script>` content first.
- If AST parsing fails or no AST rule changes the file, run string codemods.

## AST codemod contract

Define AST rules with `AstCodemod` from `src/migrate/ast/types.ts`:

- `run({ filePath, ast, source, ctx })` returns:
  - `{ ast, notes }` when transformed
  - `{ notes }` when no change (or intentionally skipped)

Minimal example:

```ts
import type { AstCodemod } from "../types";

export const myAstRule: AstCodemod = {
  name: "my-ast-rule",
  run: ({ ast }) => {
    // mutate ast here
    return { ast, notes: [] };
  }
};
```

## String codemod contract

Define string rules with `Codemod` from `src/migrate/codemods/types.ts`:

- `run({ filePath, content, ctx })` returns:
  - `{ changed: true, newContent, notes }` when transformed
  - `{ changed: false, notes }` when no change

Minimal example:

```ts
import type { Codemod } from "../types";

export const myStringRule: Codemod = {
  name: "my-string-rule",
  fileExtensions: [".js"],
  run: ({ content }) => {
    if (!content.includes("old")) return { changed: false, notes: [] };
    return { changed: true, newContent: content.replaceAll("old", "new"), notes: [] };
  }
};
```

## Register rules

Edit `src/migrate/codemods/index.ts`:

- Add AST rules to `DEFAULT_AST_CODEMODS`
- Add string rules to `DEFAULT_CODEMODS`

The CLI passes both lists to `runCodemods` in `src/cli.ts`.

## Rule authoring guidance

- Prefer AST rules when syntax/semantics matter.
- Keep string rules conservative and idempotent.
- Add tests close to each rule (for AST rules under `src/migrate/ast/rules`, for string rules under `src/migrate/codemods/rules`).
- Always cover:
  - happy path transform
  - skip path (no transform)
  - safety guard path (notes on unsafe cases)

