import { describe, it, expect } from "vitest";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { withTempDir, writeTextFile } from "../test/testUtils";
import { backupProject } from "./backupProject";

describe("backupProject", () => {
  it("respects .gitignore and default ignores", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, ".gitignore"), "ignored.txt\nsubdir/\n");
      await writeTextFile(join(dir, "keep.txt"), "ok");
      await writeTextFile(join(dir, "ignored.txt"), "no");
      await writeTextFile(join(dir, "subdir", "a.txt"), "no");
      await writeTextFile(join(dir, "node_modules", "x.txt"), "no");

      const res = await backupProject({
        projectRoot: dir,
        backupDir: ".update-your-vue2/backups"
      });

      expect(res.zipPath).toBeTruthy();
      const zip = new AdmZip(res.zipPath!);
      const entries = zip.getEntries().map((e) => e.entryName).sort();
      expect(entries).toContain("keep.txt");
      expect(entries).not.toContain("ignored.txt");
      expect(entries.some((e) => e.startsWith("subdir/"))).toBe(false);
      expect(entries.some((e) => e.startsWith("node_modules/"))).toBe(false);
    });
  });

  it("dryRun does not create a zip file", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "a.txt"), "a");
      const res = await backupProject({
        projectRoot: dir,
        backupDir: ".update-your-vue2/backups",
        dryRun: true
      });
      expect(res.zipPath).toBeUndefined();
      expect(res.includedFiles).toContain("a.txt");
    });
  });
});

