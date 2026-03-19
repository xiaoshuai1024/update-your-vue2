import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { withTempDir, writeTextFile } from "../../test/testUtils";
import { ChangeQueue } from "../../changes/changeQueue";
import { planDependencyUpgrade, applyDependencyUpgradeToQueue } from "./upgradeDependencies";

describe("dependency upgrade", () => {
  it("plans vue + vite deps for target=vite", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "demo",
            dependencies: { vue: "^2.7.0", "vue-router": "^3.5.0" },
            devDependencies: {}
          },
          null,
          2
        )
      );

      const plan = await planDependencyUpgrade(dir, {
        target: "vite",
        useCompat: false,
        generateTypes: false,
        backup: true,
        install: false
      });

      const byName = Object.fromEntries(plan.changes.map((c) => [c.name, c]));
      expect(byName.vue.to).toBe("^3");
      expect(byName["vue-router"].to).toBe("^4");
      expect(byName.vite.section).toBe("devDependencies");
      expect(byName["@vitejs/plugin-vue"].section).toBe("devDependencies");
    });
  });

  it("applies plan to package.json via ChangeQueue", async () => {
    await withTempDir(async (dir) => {
      const pkgPath = join(dir, "package.json");
      await writeTextFile(pkgPath, JSON.stringify({ name: "demo", dependencies: { vue: "^2.6.0" } }, null, 2));

      const plan = await planDependencyUpgrade(dir, {
        target: "vite",
        useCompat: false,
        generateTypes: false,
        backup: true,
        install: false
      });

      const queue = new ChangeQueue();
      applyDependencyUpgradeToQueue(queue, plan);
      await queue.apply();

      const updated = JSON.parse(await readFile(pkgPath, "utf8"));
      expect(updated.dependencies.vue).toBe("^3");
      expect(updated.devDependencies.vite).toBe("^6");
    });
  });
});

