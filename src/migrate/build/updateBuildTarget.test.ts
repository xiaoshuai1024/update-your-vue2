import { describe, it, expect } from "vitest";
import { withTempDir } from "../../test/testUtils";
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
});

