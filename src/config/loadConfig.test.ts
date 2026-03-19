import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { loadConfig } from "./loadConfig";
import { withTempDir, writeTextFile } from "../test/testUtils";

describe("loadConfig", () => {
  it("uses defaults when config file missing", async () => {
    await withTempDir(async (dir) => {
      const loaded = await loadConfig(dir, {});
      expect(loaded.config.target).toBe("vite");
      expect(loaded.config.install).toBe(false);
      expect(loaded.config.backup).toBe(true);
      expect(loaded.configPathUsed).toBeUndefined();
    });
  });

  it("merges update-your-vue2.json over defaults", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(
        join(dir, "update-your-vue2.json"),
        JSON.stringify({ target: "webpack", backup: false }, null, 2)
      );
      const loaded = await loadConfig(dir, {});
      expect(loaded.config.target).toBe("webpack");
      expect(loaded.config.backup).toBe(false);
      expect(loaded.configPathUsed).toBe(join(dir, "update-your-vue2.json"));
    });
  });

  it("CLI overrides win over config file", async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "update-your-vue2.json"), JSON.stringify({ target: "webpack" }, null, 2));
      const loaded = await loadConfig(dir, { target: "vite" });
      expect(loaded.config.target).toBe("vite");
    });
  });

  it("throws when explicit --config path is missing", async () => {
    await withTempDir(async (dir) => {
      await expect(loadConfig(dir, { configPath: "nope.json" })).rejects.toBeTruthy();
    });
  });
});

