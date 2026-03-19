import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface BackupZipInfo {
  path: string;
  filename: string;
  mtimeMs: number;
  size: number;
}

export async function listBackups(backupDirAbs: string): Promise<BackupZipInfo[]> {
  let entries: string[];
  try {
    entries = await readdir(backupDirAbs);
  } catch {
    return [];
  }

  const zips = entries.filter((f) => f.toLowerCase().endsWith(".zip"));
  const infos = await Promise.all(
    zips.map(async (filename) => {
      const path = join(backupDirAbs, filename);
      const s = await stat(path);
      return {
        path,
        filename,
        mtimeMs: s.mtimeMs,
        size: s.size
      } satisfies BackupZipInfo;
    })
  );

  infos.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return infos;
}

