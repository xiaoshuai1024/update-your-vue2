import { describe, expect, it, vi } from "vitest";
import { getInstallCommand, runInstall } from "./runInstall";

describe("runInstall", () => {
  it("maps package manager to install command", () => {
    expect(getInstallCommand("npm")).toEqual({ command: "npm", args: ["install"] });
    expect(getInstallCommand("yarn")).toEqual({ command: "yarn", args: ["install"] });
    expect(getInstallCommand("pnpm")).toEqual({ command: "pnpm", args: ["install"] });
  });

  it("uses provided runner with computed command", async () => {
    const runner = vi.fn(async () => undefined);
    await runInstall({ pm: "pnpm", cwd: "/tmp/demo", runner });
    expect(runner).toHaveBeenCalledWith({
      command: "pnpm",
      args: ["install"],
      cwd: "/tmp/demo"
    });
  });
});

