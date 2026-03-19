import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { ChangeQueue } from "./changeQueue";
import { withTempDir, writeTextFile } from "../test/testUtils";

describe("ChangeQueue", () => {
  it("preflight fails when duplicate target path exists", async () => {
    await withTempDir(async (dir) => {
      const queue = new ChangeQueue();
      const path = join(dir, "src", "main.js");
      queue.add({ kind: "writeFile", path, content: "a" });
      queue.add({ kind: "writeFile", path, content: "b" });

      const result = queue.preflight();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain(path);
      }
    });
  });

  it("apply stops on first failure and reports restore hint", async () => {
    await withTempDir(async (dir) => {
      const queue = new ChangeQueue();
      const brokenJsonPath = join(dir, "pkg.json");
      await writeTextFile(brokenJsonPath, "{ not-json }");

      queue.add({
        kind: "updateJson",
        path: brokenJsonPath,
        updater: (current) => current
      });
      const shouldNotRunPath = join(dir, "after.txt");
      queue.add({
        kind: "writeFile",
        path: shouldNotRunPath,
        content: "should-not-run"
      });

      await expect(queue.apply()).rejects.toThrow("update-your-vue2 restore");
      await expect(readFile(shouldNotRunPath, "utf8")).rejects.toBeDefined();
    });
  });
});

