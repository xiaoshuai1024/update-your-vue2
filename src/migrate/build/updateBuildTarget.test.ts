import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { withTempDir, writeTextFile } from "../../test/testUtils";
import { ChangeQueue } from "../../changes/changeQueue";
import { planBuildTarget } from "./updateBuildTarget";

describe("planBuildTarget", () => {
  it("adds vite.config.ts for target=vite", async () => {
    await withTempDir(async (dir) => {
      const queue = new ChangeQueue();
      const plan = planBuildTarget(
        dir,
        { target: "vite", useCompat: false, generateTypes: false, backup: true, install: false },
        queue
      );
      expect(plan.notes.length).toBeGreaterThan(0);
      const summary = queue.summary();
      expect(summary.changes.some((c) => c.path.endsWith("/vite.config.ts"))).toBe(true);
    });
  });

  it("adds root index.html for target=vite when missing, pointing at src/main.js", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src/main.js"), "// entry\n");
      await writeTextFile(join(dir, "package.json"), JSON.stringify({ name: "sample-app" }) + "\n");
      const queue = new ChangeQueue();
      planBuildTarget(
        dir,
        { target: "vite", useCompat: false, generateTypes: false, backup: true, install: false },
        queue
      );
      const summary = queue.summary();
      const indexWrite = summary.changes.find((c) => c.path.endsWith("/index.html"));
      expect(indexWrite).toBeDefined();
    });
  });

  it("adds root index.html referencing src/main.ts when that is the only entry", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "src/main.ts"), "export {}\n");
      const queue = new ChangeQueue();
      planBuildTarget(
        dir,
        { target: "vite", useCompat: false, generateTypes: false, backup: true, install: false },
        queue
      );
      await queue.apply();
      const { readFile } = await import("node:fs/promises");
      const raw = await readFile(join(dir, "index.html"), "utf8");
      expect(raw).toContain('/src/main.ts"');
    });
  });

  it("does not overwrite existing root index.html for target=vite", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "index.html"), "<!DOCTYPE html><html></html>\n");
      await writeTextFile(join(dir, "src/main.js"), "// entry\n");
      const queue = new ChangeQueue();
      planBuildTarget(
        dir,
        { target: "vite", useCompat: false, generateTypes: false, backup: true, install: false },
        queue
      );
      const summary = queue.summary();
      expect(summary.changes.some((c) => c.path.endsWith("/index.html"))).toBe(false);
    });
  });

  it("emits webpack notes and does not write files for target=webpack", async () => {
    await withTempDir(async (dir) => {
      const queue = new ChangeQueue();
      const plan = planBuildTarget(
        dir,
        { target: "webpack", useCompat: false, generateTypes: false, backup: true, install: false },
        queue
      );
      expect(plan.notes.some((n) => n.includes("conservative mode"))).toBe(true);
      expect(queue.summary().changes).toEqual([]);
    });
  });
});

