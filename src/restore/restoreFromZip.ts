import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import AdmZip from "adm-zip";

export interface RestoreOptions {
  projectRoot: string;
  zipPath: string;
  dryRun?: boolean;
}

export interface RestoreResult {
  filesPlanned: string[];
}

export class UnsafeZipEntryError extends Error {
  constructor(public readonly entryName: string, message: string) {
    super(message);
    this.name = "UnsafeZipEntryError";
  }
}

function isUnsafeEntryName(entryName: string): boolean {
  if (!entryName) return true;
  if (entryName.includes("\0")) return true;
  if (isAbsolute(entryName)) return true;
  // Normalize separators and block traversal
  const parts = entryName.replaceAll("\\", "/").split("/");
  return parts.some((p) => p === "..");
}

export function resolveEntryTarget(projectRoot: string, entryName: string): string {
  const normalized = entryName.replaceAll("\\", "/");
  const dest = resolve(projectRoot, normalized);
  const root = resolve(projectRoot);
  if (!dest.startsWith(root + "/") && dest !== root) {
    throw new UnsafeZipEntryError(entryName, `Entry resolves outside projectRoot: ${entryName}`);
  }
  return dest;
}

export async function restoreFromZip(options: RestoreOptions): Promise<RestoreResult> {
  const projectRoot = resolve(options.projectRoot);
  const zip = new AdmZip(options.zipPath);
  const entries = zip.getEntries();

  const filesPlanned: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName;
    const rawNameBuf: Buffer | undefined = (entry as any).rawEntryName;
    const rawName = rawNameBuf ? rawNameBuf.toString("utf8") : entryName;

    if (isUnsafeEntryName(rawName)) {
      throw new UnsafeZipEntryError(rawName, `Unsafe zip entry: ${rawName}`);
    }

    const dest = resolveEntryTarget(projectRoot, entryName);
    filesPlanned.push(dest);

    if (options.dryRun) continue;

    await mkdir(dirname(dest), { recursive: true });
    const data = entry.getData();
    await writeFile(dest, data);
  }

  filesPlanned.sort();
  return { filesPlanned };
}

