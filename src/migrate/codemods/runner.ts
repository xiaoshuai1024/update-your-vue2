import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import fg from "fast-glob";
import type { Codemod, CodemodNote } from "./types";

export interface RunCodemodsOptions {
  projectRoot: string;
  codemods: Codemod[];
  globs?: string[];
}

export interface RunCodemodsResult {
  notes: CodemodNote[];
  filesScanned: number;
}

export async function runCodemods(options: RunCodemodsOptions): Promise<RunCodemodsResult> {
  const projectRoot = resolve(options.projectRoot);
  const patterns = options.globs ?? ["**/*.{js,jsx,ts,tsx,vue}"];
  const files = await fg(patterns, {
    cwd: projectRoot,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  const notes: CodemodNote[] = [];

  for (const rel of files) {
    const abs = resolve(projectRoot, rel);
    const content = await readFile(abs, "utf8");
    const ext = rel.includes(".") ? "." + rel.split(".").pop()!.toLowerCase() : "";
    for (const mod of options.codemods) {
      if (!mod.fileExtensions.includes(ext)) continue;
      const res = mod.run({
        filePath: relative(projectRoot, abs),
        content,
        ctx: { projectRoot }
      });
      notes.push(...res.notes);
      // MVP: we are not applying code changes yet.
    }
  }

  return { notes, filesScanned: files.length };
}

