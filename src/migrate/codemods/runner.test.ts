import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { withTempDir, writeTextFile } from "../../test/testUtils";
import { runCodemods } from "./runner";
import { DEFAULT_CODEMODS } from "./index";

describe("runCodemods", () => {
  it("reports notes for suspicious Vue2 global APIs", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src", "main.js"), "import Vue from 'vue';\nVue.use(X)\nnew Vue({})\n");
      const res = await runCodemods({ projectRoot: dir, codemods: DEFAULT_CODEMODS });
      expect(res.filesScanned).toBeGreaterThan(0);
      expect(res.notes.some((n) => n.message.includes("Vue.use"))).toBe(true);
      expect(res.notes.some((n) => n.message.includes("new Vue"))).toBe(true);
    });
  });
});

