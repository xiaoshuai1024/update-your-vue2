import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { withTempDir, writeTextFile } from "../../test/testUtils";
import { resolveSrcMainEntry } from "./viteScaffold";

describe("resolveSrcMainEntry", () => {
  it("prefers main.ts over main.js when both exist", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src/main.ts"), "");
      await writeTextFile(join(dir, "src/main.js"), "");
      expect(resolveSrcMainEntry(dir).fileName).toBe("main.ts");
      expect(resolveSrcMainEntry(dir).guessed).toBe(false);
    });
  });

  it("returns guessed main.js when src has no main entry", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src/App.vue"), "");
      const r = resolveSrcMainEntry(dir);
      expect(r.fileName).toBe("main.js");
      expect(r.guessed).toBe(true);
    });
  });
});
