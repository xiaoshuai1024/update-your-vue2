import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve, relative } from "node:path";
import archiver from "archiver";
import fg from "fast-glob";
import { readGitignore, shouldIncludePath } from "./readGitignore";
import { posixPath } from "./utils";

export interface BackupOptions {
  projectRoot: string;
  backupDir: string;
  projectName?: string;
  dryRun?: boolean;
}

export interface BackupResult {
  zipPath?: string;
  includedFiles: string[];
  excludedCount: number;
  includedBytes: number;
}

function timestampForFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

async function inferProjectName(projectRoot: string): Promise<string> {
  try {
    const pkgPath = join(projectRoot, "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    if (pkg && typeof pkg.name === "string" && pkg.name.trim()) return pkg.name.trim();
  } catch {
    // ignore
  }
  return basename(projectRoot);
}

export async function backupProject(options: BackupOptions): Promise<BackupResult> {
  const projectRoot = resolve(options.projectRoot);
  const backupDirAbs = resolve(projectRoot, options.backupDir);

  const projectName = options.projectName ?? (await inferProjectName(projectRoot));
  const zipName = `${projectName}-${timestampForFilename()}.zip`;
  const zipPath = join(backupDirAbs, zipName);

  // Ensure we don't include the backup directory itself (relative path from root)
  const backupDirRel = posixPath(relative(projectRoot, backupDirAbs));
  const extraIgnores = backupDirRel && backupDirRel !== "" && backupDirRel !== "." ? [`${backupDirRel}/`] : [];

  const { ig } = await readGitignore(projectRoot, extraIgnores);

  const candidates = await fg(["**/*"], {
    cwd: projectRoot,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  const includedFiles: string[] = [];
  let excludedCount = 0;
  let includedBytes = 0;

  for (const rel of candidates) {
    const relPosix = posixPath(rel);
    if (!shouldIncludePath(ig, relPosix)) {
      excludedCount += 1;
      continue;
    }
    includedFiles.push(relPosix);
    try {
      const s = await stat(join(projectRoot, rel));
      includedBytes += s.size;
    } catch {
      // ignore size failures
    }
  }

  includedFiles.sort();

  if (options.dryRun) {
    return { includedFiles, excludedCount, includedBytes };
  }

  await mkdir(backupDirAbs, { recursive: true });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolvePromise());
    output.on("error", (err: unknown) => rejectPromise(err));
    archive.on("warning", (err) => {
      // Non-blocking warnings (e.g. stat failures) are ignored; anything else is fatal.
      // archiver uses `code === 'ENOENT'` for missing files.
      if ((err as any)?.code === "ENOENT") return;
      rejectPromise(err);
    });
    archive.on("error", (err: unknown) => rejectPromise(err));

    archive.pipe(output);
    for (const relPosix of includedFiles) {
      const abs = join(projectRoot, relPosix);
      archive.file(abs, { name: relPosix });
    }
    void archive.finalize();
  });

  return { zipPath, includedFiles, excludedCount, includedBytes };
}

