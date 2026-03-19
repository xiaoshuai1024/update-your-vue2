import { spawn } from "node:child_process";
import type { PackageManager } from "../scan/detectPackageManager";

export interface InstallRunnerArgs {
  command: string;
  args: string[];
  cwd: string;
}

export type InstallRunner = (args: InstallRunnerArgs) => Promise<void>;

export interface RunInstallOptions {
  pm: PackageManager;
  cwd: string;
  runner?: InstallRunner;
}

export function getInstallCommand(pm: PackageManager): { command: string; args: string[] } {
  if (pm === "yarn") return { command: "yarn", args: ["install"] };
  if (pm === "pnpm") return { command: "pnpm", args: ["install"] };
  return { command: "npm", args: ["install"] };
}

const defaultRunner: InstallRunner = ({ command, args, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Install command failed: ${command} ${args.join(" ")} (exit ${code ?? "unknown"})`));
    });
  });

export async function runInstall(options: RunInstallOptions): Promise<void> {
  const { command, args } = getInstallCommand(options.pm);
  const runner = options.runner ?? defaultRunner;
  await runner({ command, args, cwd: options.cwd });
}

