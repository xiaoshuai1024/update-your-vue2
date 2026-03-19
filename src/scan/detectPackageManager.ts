import { access } from "node:fs/promises";
import { join } from "node:path";

export type PackageManager = "npm" | "yarn" | "pnpm";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  if (await exists(join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(join(projectRoot, "yarn.lock"))) return "yarn";
  if (await exists(join(projectRoot, "package-lock.json"))) return "npm";
  return "npm";
}

