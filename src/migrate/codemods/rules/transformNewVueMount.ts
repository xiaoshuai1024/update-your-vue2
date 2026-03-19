import type { Codemod, CodemodNote } from "../types";

type Quote = "'" | '"';

function addNote(notes: CodemodNote[], filePath: string, message: string) {
  notes.push({ filePath, message });
}

function extractAppIdentifierFromOptions(optionsObjectLiteral: string): string | null {
  // Only accept these conservative render forms (no parens around h, no method shorthand):
  // - render: h => h(App)
  // - render: function(h){ return h(App) }
  //
  // We allow any identifier name for h, but require it be used consistently.
  const arrow = /\brender\s*:\s*(?<h>[A-Za-z_$][\w$]*)\s*=>\s*(?<h2>[A-Za-z_$][\w$]*)\s*\(\s*(?<app>[A-Za-z_$][\w$]*)\s*\)\s*(?:,|})/s.exec(
    optionsObjectLiteral
  );
  if (arrow && arrow.groups?.h && arrow.groups.h === arrow.groups.h2 && arrow.groups.app) {
    return arrow.groups.app;
  }

  const fn =
    /\brender\s*:\s*function\s*\(\s*(?<h>[A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+(?<h2>[A-Za-z_$][\w$]*)\s*\(\s*(?<app>[A-Za-z_$][\w$]*)\s*\)\s*;?\s*\}\s*(?:,|})/s.exec(
      optionsObjectLiteral
    );
  if (fn && fn.groups?.h && fn.groups.h === fn.groups.h2 && fn.groups.app) {
    return fn.groups.app;
  }

  return null;
}

function upsertCreateAppImport(content: string): { content: string; changed: boolean } {
  // If createApp is already imported from 'vue' / "vue", do nothing.
  const alreadyHasCreateApp =
    /^\s*import\s*\{[^}]*\bcreateApp\b[^}]*\}\s*from\s+(['"])vue\1\s*;?\s*$/m.test(content) ||
    /^\s*import\s+Vue\s*,\s*\{[^}]*\bcreateApp\b[^}]*\}\s*from\s+(['"])vue\1\s*;?\s*$/m.test(content);
  if (alreadyHasCreateApp) return { content, changed: false };

  // Replace `import Vue from "vue"` or `import Vue, { x } from "vue"` with named import incl createApp.
  const importVueDefaultOnly = /^\s*import\s+Vue\s+from\s+(['"])vue\1\s*;?\s*$/m;
  const importVueDefaultAndNamed = /^\s*import\s+Vue\s*,\s*\{([^}]*)\}\s*from\s+(['"])vue\2\s*;?\s*$/m;

  if (importVueDefaultAndNamed.test(content)) {
    return {
      content: content.replace(importVueDefaultAndNamed, (_m, named: string, q: Quote) => {
        const parts = named
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        if (!parts.includes("createApp")) parts.unshift("createApp");
        return `import { ${parts.join(", ")} } from ${q}vue${q};`;
      }),
      changed: true
    };
  }

  if (importVueDefaultOnly.test(content)) {
    return {
      content: content.replace(importVueDefaultOnly, (_m, q: Quote) => `import { createApp } from ${q}vue${q};`),
      changed: true
    };
  }

  // Add createApp to existing named import from vue.
  const importNamedFromVue = /^\s*import\s*\{([^}]*)\}\s*from\s+(['"])vue\2\s*;?\s*$/m;
  if (importNamedFromVue.test(content)) {
    return {
      content: content.replace(importNamedFromVue, (_m, named: string, q: Quote) => {
        const parts = named
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.includes("createApp")) return _m;
        parts.unshift("createApp");
        return `import { ${parts.join(", ")} } from ${q}vue${q};`;
      }),
      changed: true
    };
  }

  // Otherwise, insert at top (after shebang if present).
  const shebang = content.startsWith("#!") ? content.split("\n", 1)[0] + "\n" : "";
  const rest = shebang ? content.slice(shebang.length) : content;
  const importLine = `import { createApp } from "vue";\n`;
  const next = shebang + importLine + rest;
  return { content: next, changed: true };
}

export const transformNewVueMount: Codemod = {
  name: "transform-new-vue-mount",
  fileExtensions: [".js", ".ts", ".jsx", ".tsx"],
  run: ({ filePath, content }) => {
    const notes: CodemodNote[] = [];

    if (!content.includes("new Vue") || !content.includes("$mount")) {
      return { changed: false, notes };
    }

    // Very conservative: only match an options object that contains ONLY `render: ...` (no nested braces),
    // and only accept a simple mount argument (string literal or identifier).
    //
    // This avoids broken transforms when the options object has nested `{}` or when `$mount(...)` contains nested `()`.
    const pattern =
      /new\s+Vue\s*\(\s*\{\s*(?:(?:render\s*:\s*(?<h>[A-Za-z_$][\w$]*)\s*=>\s*(?<h2>[A-Za-z_$][\w$]*)\s*\(\s*(?<appArrow>[A-Za-z_$][\w$]*)\s*\)\s*)|(?:render\s*:\s*function\s*\(\s*(?<hf>[A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+(?<hf2>[A-Za-z_$][\w$]*)\s*\(\s*(?<appFn>[A-Za-z_$][\w$]*)\s*\)\s*;?\s*\}\s*))\s*\}\s*\)\s*\.\s*\$mount\s*\(\s*(?<mountArg>(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*))\s*\)\s*;?/g;

    const matches = Array.from(content.matchAll(pattern));
    if (matches.length === 0) {
      addNote(notes, filePath, "Detected `new Vue(...).$mount(...)` but could not safely match the full expression.");
      return { changed: false, notes };
    }
    if (matches.length > 1) {
      addNote(
        notes,
        filePath,
        "Detected multiple `new Vue(...).$mount(...)` expressions; skipping transform to avoid unintended changes."
      );
      return { changed: false, notes };
    }

    const m = matches[0];
    const full = m[0];
    const mountArg = m.groups?.mountArg?.trim();
    if (!mountArg) {
      addNote(notes, filePath, "Matched `new Vue(...).$mount(...)` but failed to extract mount arg safely.");
      return { changed: false, notes };
    }

    // Determine the App identifier from the approved render shapes.
    const appId =
      m.groups?.appArrow ||
      m.groups?.appFn ||
      null;
    if (!appId) {
      addNote(notes, filePath, "Matched `new Vue(...).$mount(...)` but could not capture App identifier safely.");
      return { changed: false, notes };
    }

    // If we are going to remove/replace a default `Vue` import, ensure the `Vue` identifier isn't used elsewhere.
    // Otherwise we'd break `Vue.use(...)`, `Vue.prototype...`, etc.
    const importVueDefaultOnly = /^\s*import\s+Vue\s+from\s+(['"])vue\1\s*;?\s*$/m;
    const importVueDefaultAndNamed = /^\s*import\s+Vue\s*,\s*\{[^}]*\}\s*from\s+(['"])vue\1\s*;?\s*$/m;
    if (importVueDefaultOnly.test(content) || importVueDefaultAndNamed.test(content)) {
      const withoutNewVue = content.replace(full, "");
      const withoutImport = withoutNewVue
        .replace(importVueDefaultAndNamed, "")
        .replace(importVueDefaultOnly, "");
      if (/\bVue\b/.test(withoutImport)) {
        addNote(
          notes,
          filePath,
          "Skipped new Vue() transform because Vue identifier is still referenced in this file; import rewrite would be unsafe."
        );
        return { changed: false, notes };
      }
    }

    // Replace the exact matched expression.
    const replacement = `createApp(${appId}).mount(${mountArg});`;
    let nextContent = content.replace(full, replacement);

    const importRes = upsertCreateAppImport(nextContent);
    nextContent = importRes.content;

    if (nextContent === content) {
      return { changed: false, notes };
    }

    return { changed: true, newContent: nextContent, notes };
  }
};

