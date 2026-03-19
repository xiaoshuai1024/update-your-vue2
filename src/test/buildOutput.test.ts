import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

describe("build output", () => {
  let distPath: string;

  beforeAll(() => {
    distPath = join(process.cwd(), "dist");
  });

  it("all relative imports have .js extensions for ESM compatibility", () => {
    const errors: string[] = [];

    function checkFile(filePath: string) {
      if (!filePath.endsWith(".js")) return;

      const content = readFileSync(filePath, "utf8");
      const relativeImports = content.match(/from ["']\.\.?\/[^'"]*["']/g) || [];

      for (const imp of relativeImports) {
        const pathMatch = imp.match(/from ["'](\.\.?\/[^'"]+)["']/);
        if (pathMatch) {
          const importPath = pathMatch[1];
          if (!importPath.endsWith(".js") && !importPath.includes(".")) {
            errors.push(`${filePath}: missing .js extension in ${imp}`);
          }
        }
      }
    }

    function walkDir(dir: string) {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
          walkDir(fullPath);
        } else {
          checkFile(fullPath);
        }
      }
    }

    walkDir(distPath);
    expect(errors, `Found imports without .js extension:\n${errors.join("\n")}`).toHaveLength(0);
  });

  it("CLI can be executed after build", () => {
    const output = execSync("node dist/cli.js --help", {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 10000,
    });
    expect(output).toContain("Usage:");
  });

  it("build produces all expected files", () => {
    const cliPath = join(distPath, "cli.js");
    const indexPath = join(distPath, "index.js");
    const configPath = join(distPath, "config", "loadConfig.js");

    expect(readFileSync(cliPath, "utf8")).toBeTruthy();
    expect(readFileSync(indexPath, "utf8")).toBeTruthy();
    expect(readFileSync(configPath, "utf8")).toBeTruthy();
  });
});
