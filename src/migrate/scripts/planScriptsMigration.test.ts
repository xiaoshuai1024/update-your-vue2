import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { withTempDir, writeTextFile } from "../../test/testUtils";
import { ChangeQueue } from "../../changes/changeQueue";
import { applyScriptsMigrationToQueue, planScriptsMigration } from "./planScriptsMigration";

describe("planScriptsMigration", () => {
  it("rewrites dev/build/preview for target=vite and backs up old scripts", async () => {
    await withTempDir(async (dir) => {
      const pkgPath = join(dir, "package.json");
      await writeTextFile(
        pkgPath,
        JSON.stringify(
          {
            name: "demo",
            scripts: {
              dev: "webpack serve",
              build: "webpack",
              preview: "node preview.js",
              lint: "eslint ."
            }
          },
          null,
          2
        )
      );

      const plan = await planScriptsMigration(dir, {
        target: "vite",
        useCompat: false,
        generateTypes: false,
        backup: true,
        install: false
      });
      expect(plan.changed).toBe(true);

      const queue = new ChangeQueue();
      applyScriptsMigrationToQueue(queue, plan, "vite");
      await queue.apply();

      const updated = JSON.parse(await readFile(pkgPath, "utf8"));
      expect(updated.scripts.dev).toBe("vite");
      expect(updated.scripts.build).toBe("vite build");
      expect(updated.scripts.preview).toBe("vite preview");
      expect(updated.scripts.lint).toBe("eslint .");
      expect(updated.updateYourVue2.backupScripts.dev).toBe("webpack serve");
    });
  });

  it("keeps scripts unchanged for target=webpack", async () => {
    await withTempDir(async (dir) => {
      const pkgPath = join(dir, "package.json");
      await writeTextFile(
        pkgPath,
        JSON.stringify({ name: "demo", scripts: { dev: "webpack serve", build: "webpack" } }, null, 2)
      );

      const plan = await planScriptsMigration(dir, {
        target: "webpack",
        useCompat: false,
        generateTypes: false,
        backup: true,
        install: false
      });
      expect(plan.changed).toBe(false);
      expect(plan.notes.some((n) => n.includes("conservative"))).toBe(true);
    });
  });
});

