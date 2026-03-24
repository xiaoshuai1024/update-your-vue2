import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { withTempDir, writeTextFile } from "../../test/testUtils";
import { runCodemods } from "./runner";
import { DEFAULT_AST_CODEMODS, DEFAULT_CODEMODS } from "./index";
import type { Codemod } from "./types";

describe("runCodemods", () => {
  it("reports notes for suspicious Vue2 global APIs", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src", "main.js"), "import Vue from 'vue';\nVue.use(X)\nnew Vue({})\n");
      const res = await runCodemods({ projectRoot: dir, codemods: DEFAULT_CODEMODS });
      expect(res.filesScanned).toBeGreaterThan(0);
      expect(res.edits).toEqual([]);
      expect(res.notes.some((n) => n.message.includes("Vue.use"))).toBe(true);
      expect(res.notes.some((n) => n.message.includes("new Vue"))).toBe(true);
    });
  });

  it("ignores node_modules by default", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src", "main.js"), "// app\n");
      await writeTextFile(
        join(dir, "node_modules", "some-pkg", "index.js"),
        "import Vue from 'vue';\nVue.use(X)\nnew Vue({})\n"
      );

      const res = await runCodemods({ projectRoot: dir, codemods: DEFAULT_CODEMODS });
      expect(res.filesScanned).toBe(1);
      expect(res.edits).toEqual([]);
      expect(res.notes).toEqual([]);
    });
  });

  it("ignores .git/dist/coverage/.update-your-vue2 by default", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src", "main.js"), "// app\n");
      const suspicious = "import Vue from 'vue';\nVue.use(X)\nnew Vue({})\n";

      // Some environments may restrict creating `.git/` inside tmp dirs; best-effort.
      try {
        await writeTextFile(join(dir, ".git", "hooks", "post-commit.js"), suspicious);
      } catch {
        // ignore
      }
      await writeTextFile(join(dir, "dist", "out.js"), suspicious);
      await writeTextFile(join(dir, "coverage", "report.js"), suspicious);
      await writeTextFile(join(dir, ".update-your-vue2", "tmp.js"), suspicious);

      const res = await runCodemods({ projectRoot: dir, codemods: DEFAULT_CODEMODS });
      expect(res.filesScanned).toBe(1);
      expect(res.notes).toEqual([]);
    });
  });

  it("can disable default ignores (includeDefaultIgnores=false)", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src", "main.js"), "// app\n");
      await writeTextFile(
        join(dir, "node_modules", "some-pkg", "index.js"),
        "import Vue from 'vue';\nVue.use(X)\nnew Vue({})\n"
      );

      const res = await runCodemods({
        projectRoot: dir,
        codemods: DEFAULT_CODEMODS,
        includeDefaultIgnores: false
      });
      expect(res.filesScanned).toBe(2);
      expect(res.notes.length).toBeGreaterThan(0);
    });
  });

  it("returns final edits after sequential codemods touch same file", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "src", "x.js");
      await writeTextFile(filePath, "foo\n");

      const mod1: Codemod = {
        name: "mod1",
        fileExtensions: [".js"],
        run: ({ filePath, content }) => {
          if (!content.includes("foo")) return { changed: false, notes: [] };
          return { changed: true, newContent: content.replace("foo", "bar"), notes: [{ filePath, message: "mod1" }] };
        }
      };
      const mod2: Codemod = {
        name: "mod2",
        fileExtensions: [".js"],
        run: ({ filePath, content }) => {
          if (!content.includes("bar")) return { changed: false, notes: [] };
          return { changed: true, newContent: content.replace("bar", "baz"), notes: [{ filePath, message: "mod2" }] };
        }
      };

      const res = await runCodemods({ projectRoot: dir, codemods: [mod1, mod2] });
      expect(res.edits).toHaveLength(1);
      expect(res.edits[0].filePath).toBe("src/x.js");
      expect(res.edits[0].newContent).toBe("baz\n");
      expect(res.notes.map((n) => n.message)).toEqual(["mod1", "mod2"]);
    });
  });

  it("does not write to disk (returns edits only)", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "src", "main.js");
      await writeTextFile(filePath, "hello\n");

      const mod: Codemod = {
        name: "replace-hello",
        fileExtensions: [".js"],
        run: ({ content }) => {
          if (!content.includes("hello")) return { changed: false, notes: [] };
          return { changed: true, newContent: content.replace("hello", "goodbye"), notes: [] };
        }
      };

      const before = await readFile(filePath, "utf8");
      const res = await runCodemods({ projectRoot: dir, codemods: [mod] });
      expect(res.edits).toHaveLength(1);
      const after = await readFile(filePath, "utf8");
      expect(after).toBe(before);
    });
  });

  it("keeps existing behavior when astCodemods is empty", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "src", "main.js");
      const source = [
        "import Vue from 'vue';",
        "import App from './App.vue';",
        "new Vue({",
        "  render: h => h(App)",
        "}).$mount('#app');",
        ""
      ].join("\n");
      await writeTextFile(filePath, source);

      const res = await runCodemods({
        projectRoot: dir,
        codemods: DEFAULT_CODEMODS,
        astCodemods: []
      });

      expect(res.edits).toHaveLength(1);
      expect(res.edits[0].newContent).toContain("createApp(App).mount('#app');");
    });
  });

  it("falls back to string codemods when AST parse fails", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "src", "broken.js");
      await writeTextFile(filePath, "const broken =\n");

      const stringFallback: Codemod = {
        name: "string-fallback",
        fileExtensions: [".js"],
        run: ({ filePath, content }) => ({
          changed: true,
          newContent: `${content}// fallback-applied\n`,
          notes: [{ filePath, message: "string fallback ran" }]
        })
      };

      const res = await runCodemods({
        projectRoot: dir,
        codemods: [stringFallback],
        astCodemods: [
          {
            name: "noop-ast",
            run: ({ ast }) => ({ ast, notes: [] })
          }
        ]
      });

      expect(res.edits).toHaveLength(1);
      expect(res.edits[0].newContent).toContain("// fallback-applied");
      expect(res.notes.some((n) => n.message.includes("AST parse failed"))).toBe(true);
      expect(res.notes.some((n) => n.message.includes("string fallback ran"))).toBe(true);
    });
  });

  it("transforms .vue script via AST and preserves SFC structure", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "src", "AppShell.vue");
      const source = `<template><div id="app"></div></template>
<script>
import Vue from "vue";
import App from "./App.vue";
new Vue({ render: h => h(App) }).$mount("#app");
</script>
<style scoped>.root { color: red; }</style>
`;
      await writeTextFile(filePath, source);

      const res = await runCodemods({
        projectRoot: dir,
        codemods: DEFAULT_CODEMODS,
        astCodemods: DEFAULT_AST_CODEMODS
      });
      expect(res.edits).toHaveLength(1);
      const out = res.edits[0].newContent;
      expect(out).toContain("<template><div id=\"app\"></div></template>");
      expect(out).toContain("<style scoped>.root { color: red; }</style>");
      expect(out).toContain("createApp(App).mount(\"#app\");");
      expect(out).not.toContain("new Vue");
    });
  });

  it("keeps Vue default import when still referenced after AST transform", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "src", "main.js");
      const source = [
        'import Vue from "vue";',
        'import App from "./App.vue";',
        "Vue.use(foo);",
        'new Vue({ render: (h) => h(App) }).$mount(document.querySelector("#app"));',
        ""
      ].join("\n");
      await writeTextFile(filePath, source);

      const res = await runCodemods({
        projectRoot: dir,
        codemods: DEFAULT_CODEMODS,
        astCodemods: DEFAULT_AST_CODEMODS
      });

      expect(res.edits).toHaveLength(1);
      const out = res.edits[0].newContent;
      expect(out).toContain('import { createApp } from "vue";');
      expect(out).toContain('import * as Vue from "vue";');
      expect(out).toContain("Vue.use(foo);");
      expect(out).toContain('createApp(App).mount(document.querySelector("#app"));');
      expect(res.notes.some((n) => n.message.includes("could not safely match"))).toBe(false);
    });
  });

  it("removes Vue.config.productionTip to avoid Vue3 runtime crash", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "src", "main.js");
      const source = [
        'import Vue from "vue";',
        'import App from "./App.vue";',
        "Vue.config.productionTip = false;",
        'new Vue({ render: h => h(App) }).$mount("#app");',
        ""
      ].join("\n");
      await writeTextFile(filePath, source);

      const res = await runCodemods({
        projectRoot: dir,
        codemods: DEFAULT_CODEMODS,
        astCodemods: DEFAULT_AST_CODEMODS
      });

      expect(res.edits).toHaveLength(1);
      const out = res.edits[0].newContent;
      expect(out).not.toContain("Vue.config.productionTip");
      expect(out).toContain('createApp(App).mount("#app");');
    });
  });
});

