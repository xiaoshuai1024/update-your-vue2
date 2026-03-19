import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { UpdateYourVue2Config } from "../../config/schema";
import type { ChangeQueue } from "../../changes/changeQueue";
import { computeDependencyRules } from "./rules";

export interface DependencyUpgradePlan {
  packageJsonPath: string;
  changes: Array<{ name: string; from?: string; to: string; section: "dependencies" | "devDependencies" }>;
  notes: string[];
}

async function readPackageJson(packageJsonPath: string): Promise<any> {
  try {
    const raw = await readFile(packageJsonPath, "utf8");
    return JSON.parse(raw);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(
        `Cannot find package.json at ${packageJsonPath}. ` +
          `Make sure you run update-your-vue2 in a project root (or pass [projectRoot]).`
      );
    }
    throw err;
  }
}

export async function planDependencyUpgrade(
  projectRoot: string,
  config: UpdateYourVue2Config
): Promise<DependencyUpgradePlan> {
  const packageJsonPath = join(projectRoot, "package.json");
  const pkg = await readPackageJson(packageJsonPath);

  const { changes, notes } = computeDependencyRules(pkg, {
    target: config.target,
    useCompat: config.useCompat
  });

  return { packageJsonPath, changes, notes };
}

export function applyDependencyUpgradeToQueue(queue: ChangeQueue, plan: DependencyUpgradePlan) {
  if (plan.changes.length === 0) return;

  queue.add({
    kind: "updateJson",
    path: plan.packageJsonPath,
    updater: (current) => {
      const pkg: any = typeof current === "object" && current ? { ...(current as any) } : {};
      pkg.dependencies = { ...(pkg.dependencies ?? {}) };
      pkg.devDependencies = { ...(pkg.devDependencies ?? {}) };

      for (const change of plan.changes) {
        if (change.section === "dependencies") pkg.dependencies[change.name] = change.to;
        else pkg.devDependencies[change.name] = change.to;
      }

      return pkg;
    }
  });
}

