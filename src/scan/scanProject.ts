import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import fg from "fast-glob";
import { detectPackageManager, type PackageManager } from "./detectPackageManager";

export type ProjectKind = "vue-cli-webpack" | "custom-webpack" | "unknown";

export interface ScanResult {
  projectRoot: string;
  packageManager: PackageManager;
  projectKind: ProjectKind;
  hasVueConfig: boolean;
  webpackConfigGlobs: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson(projectRoot: string): Promise<any | undefined> {
  try {
    const raw = await readFile(join(projectRoot, "package.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function hasDependency(pkg: any | undefined, name: string): boolean {
  if (!pkg) return false;
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return typeof deps[name] === "string";
}

export async function scanProject(projectRoot: string): Promise<ScanResult> {
  const packageManager = await detectPackageManager(projectRoot);
  const pkg = await readPackageJson(projectRoot);

  const hasVueConfig = await exists(join(projectRoot, "vue.config.js"));
  const looksLikeVueCli = hasVueConfig || hasDependency(pkg, "@vue/cli-service");

  const webpackMatches = await fg(["webpack*.{js,cjs,mjs,ts}", "build/webpack*.{js,cjs,mjs,ts}"], {
    cwd: projectRoot,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  const looksLikeCustomWebpack = webpackMatches.length > 0 || (await exists(join(projectRoot, "build")));

  let projectKind: ProjectKind = "unknown";
  if (looksLikeVueCli) projectKind = "vue-cli-webpack";
  else if (looksLikeCustomWebpack) projectKind = "custom-webpack";

  return {
    projectRoot,
    packageManager,
    projectKind,
    hasVueConfig,
    webpackConfigGlobs: webpackMatches.sort()
  };
}

