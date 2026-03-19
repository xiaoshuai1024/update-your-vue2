import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { UpdateYourVue2Config } from "../../config/schema";
import type { ChangeQueue } from "../../changes/changeQueue";

type ScriptsMap = Record<string, string>;

export interface ScriptsMigrationPlan {
  packageJsonPath: string;
  changed: boolean;
  notes: string[];
}

async function readPackageJson(packageJsonPath: string): Promise<any> {
  const raw = await readFile(packageJsonPath, "utf8");
  return JSON.parse(raw);
}

function buildScriptsForTarget(currentScripts: ScriptsMap, target: UpdateYourVue2Config["target"]): ScriptsMap {
  const next = { ...currentScripts };
  if (target === "vite") {
    next.dev = "vite";
    next.build = "vite build";
    next.preview = "vite preview";
    return next;
  }

  // webpack: conservative, keep current scripts as-is
  return next;
}

export async function planScriptsMigration(
  projectRoot: string,
  config: UpdateYourVue2Config
): Promise<ScriptsMigrationPlan> {
  const packageJsonPath = join(projectRoot, "package.json");
  const pkg = await readPackageJson(packageJsonPath);
  const currentScripts: ScriptsMap = typeof pkg?.scripts === "object" && pkg.scripts ? { ...pkg.scripts } : {};
  const nextScripts = buildScriptsForTarget(currentScripts, config.target);
  const changed = JSON.stringify(currentScripts) !== JSON.stringify(nextScripts);
  const notes: string[] = [];

  if (config.target === "webpack") {
    notes.push("target=webpack: scripts migration uses conservative mode (existing scripts are preserved).");
  }
  if (changed) {
    notes.push("package.json scripts will be updated for target runtime.");
  }

  return { packageJsonPath, changed, notes };
}

export function applyScriptsMigrationToQueue(queue: ChangeQueue, plan: ScriptsMigrationPlan, target: UpdateYourVue2Config["target"]) {
  if (!plan.changed) return;

  queue.add({
    kind: "updateJson",
    path: plan.packageJsonPath,
    updater: (current) => {
      const pkg: any = typeof current === "object" && current ? { ...(current as any) } : {};
      const currentScripts = typeof pkg.scripts === "object" && pkg.scripts ? { ...pkg.scripts } : {};
      const nextScripts = buildScriptsForTarget(currentScripts, target);
      pkg.scripts = nextScripts;
      pkg.updateYourVue2 = {
        ...(typeof pkg.updateYourVue2 === "object" && pkg.updateYourVue2 ? pkg.updateYourVue2 : {}),
        backupScripts: currentScripts
      };
      return pkg;
    }
  });
}

