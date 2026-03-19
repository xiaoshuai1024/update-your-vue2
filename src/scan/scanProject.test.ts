import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { withTempDir, writeTextFile } from "../test/testUtils";
import { scanProject } from "./scanProject";

describe("scanProject", () => {
  it("detects pnpm via lockfile", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "pnpm-lock.yaml"), "lock");
      const scan = await scanProject(dir);
      expect(scan.packageManager).toBe("pnpm");
    });
  });

  it("detects vue-cli project via vue.config.js", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "vue.config.js"), "module.exports = {}");
      const scan = await scanProject(dir);
      expect(scan.projectKind).toBe("vue-cli-webpack");
      expect(scan.hasVueConfig).toBe(true);
    });
  });

  it("detects custom webpack project via webpack config files", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "webpack.config.js"), "module.exports = {}");
      const scan = await scanProject(dir);
      expect(scan.projectKind).toBe("custom-webpack");
      expect(scan.webpackConfigGlobs).toContain("webpack.config.js");
    });
  });
});

