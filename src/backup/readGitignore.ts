import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";
import { posixPath } from "./utils";

export const DEFAULT_BACKUP_IGNORES = [
  ".git/",
  "node_modules/",
  "dist/",
  "coverage/",
  ".update-your-vue2/"
];

export interface GitignoreResult {
  ig: Ignore;
  hasGitignore: boolean;
  gitignorePath: string;
}

export async function readGitignore(projectRoot: string, extraIgnores: string[] = []): Promise<GitignoreResult> {
  const gitignorePath = join(projectRoot, ".gitignore");
  const ig = ignore();

  ig.add(DEFAULT_BACKUP_IGNORES);
  if (extraIgnores.length) ig.add(extraIgnores);

  try {
    const content = await readFile(gitignorePath, "utf8");
    // Normalize to posix newlines not required; ignore handles it, but trim to avoid empty last line noise.
    ig.add(content);
    return { ig, hasGitignore: true, gitignorePath };
  } catch {
    return { ig, hasGitignore: false, gitignorePath };
  }
}

export function shouldIncludePath(ig: Ignore, relativePath: string): boolean {
  // ignore expects POSIX-style paths relative to project root
  const rel = posixPath(relativePath);
  return !ig.ignores(rel);
}

