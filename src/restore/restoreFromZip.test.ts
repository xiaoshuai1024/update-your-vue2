import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import AdmZip from "adm-zip";
import { withTempDir, writeTextFile } from "../test/testUtils";
import { restoreFromZip, UnsafeZipEntryError } from "./restoreFromZip";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(filename: string, data: Buffer): Buffer {
  const nameBuf = Buffer.from(filename, "utf8");
  const crc = crc32(data);
  const localHeader = Buffer.alloc(30);
  let o = 0;
  localHeader.writeUInt32LE(0x04034b50, o); // local file header sig
  o += 4;
  localHeader.writeUInt16LE(20, o); // version needed
  o += 2;
  localHeader.writeUInt16LE(0, o); // flags
  o += 2;
  localHeader.writeUInt16LE(0, o); // compression: store
  o += 2;
  localHeader.writeUInt16LE(0, o); // mod time
  o += 2;
  localHeader.writeUInt16LE(0, o); // mod date
  o += 2;
  localHeader.writeUInt32LE(crc, o);
  o += 4;
  localHeader.writeUInt32LE(data.length, o); // compressed size
  o += 4;
  localHeader.writeUInt32LE(data.length, o); // uncompressed size
  o += 4;
  localHeader.writeUInt16LE(nameBuf.length, o); // filename length
  o += 2;
  localHeader.writeUInt16LE(0, o); // extra length

  const localRecord = Buffer.concat([localHeader, nameBuf, data]);
  const localOffset = 0;

  const centralHeader = Buffer.alloc(46);
  o = 0;
  centralHeader.writeUInt32LE(0x02014b50, o); // central dir sig
  o += 4;
  centralHeader.writeUInt16LE(20, o); // version made by
  o += 2;
  centralHeader.writeUInt16LE(20, o); // version needed
  o += 2;
  centralHeader.writeUInt16LE(0, o); // flags
  o += 2;
  centralHeader.writeUInt16LE(0, o); // compression
  o += 2;
  centralHeader.writeUInt16LE(0, o); // mod time
  o += 2;
  centralHeader.writeUInt16LE(0, o); // mod date
  o += 2;
  centralHeader.writeUInt32LE(crc, o);
  o += 4;
  centralHeader.writeUInt32LE(data.length, o);
  o += 4;
  centralHeader.writeUInt32LE(data.length, o);
  o += 4;
  centralHeader.writeUInt16LE(nameBuf.length, o);
  o += 2;
  centralHeader.writeUInt16LE(0, o); // extra len
  o += 2;
  centralHeader.writeUInt16LE(0, o); // comment len
  o += 2;
  centralHeader.writeUInt16LE(0, o); // disk start
  o += 2;
  centralHeader.writeUInt16LE(0, o); // int attrs
  o += 2;
  centralHeader.writeUInt32LE(0, o); // ext attrs
  o += 4;
  centralHeader.writeUInt32LE(localOffset, o); // local header offset

  const centralRecord = Buffer.concat([centralHeader, nameBuf]);
  const centralOffset = localRecord.length;
  const centralSize = centralRecord.length;

  const end = Buffer.alloc(22);
  o = 0;
  end.writeUInt32LE(0x06054b50, o); // end sig
  o += 4;
  end.writeUInt16LE(0, o); // disk
  o += 2;
  end.writeUInt16LE(0, o); // disk start
  o += 2;
  end.writeUInt16LE(1, o); // entries on disk
  o += 2;
  end.writeUInt16LE(1, o); // total entries
  o += 2;
  end.writeUInt32LE(centralSize, o);
  o += 4;
  end.writeUInt32LE(centralOffset, o);
  o += 4;
  end.writeUInt16LE(0, o); // comment len

  return Buffer.concat([localRecord, centralRecord, end]);
}

describe("restoreFromZip", () => {
  it("restores files into projectRoot", async () => {
    await withTempDir(async (dir) => {
      const zipPath = join(dir, "backup.zip");
      const zip = new AdmZip();
      zip.addFile("a.txt", Buffer.from("A"));
      zip.addFile("nested/b.txt", Buffer.from("B"));
      zip.writeZip(zipPath);

      const res = await restoreFromZip({ projectRoot: dir, zipPath });
      expect(res.filesPlanned.some((p) => p.endsWith("/a.txt"))).toBe(true);
      expect(res.filesPlanned.some((p) => p.endsWith("/nested/b.txt"))).toBe(true);
      expect(await readFile(join(dir, "a.txt"), "utf8")).toBe("A");
      expect(await readFile(join(dir, "nested/b.txt"), "utf8")).toBe("B");
    });
  });

  it("dryRun does not write files", async () => {
    await withTempDir(async (dir) => {
      const zipPath = join(dir, "backup.zip");
      const zip = new AdmZip();
      zip.addFile("a.txt", Buffer.from("A"));
      zip.writeZip(zipPath);

      const res = await restoreFromZip({ projectRoot: dir, zipPath, dryRun: true });
      expect(res.filesPlanned.length).toBe(1);
      await expect(readFile(join(dir, "a.txt"), "utf8")).rejects.toBeTruthy();
    });
  });

  it("rejects zip slip entries", async () => {
    await withTempDir(async (dir) => {
      const zipPath = join(dir, "backup.zip");
      const zipBytes = buildStoredZip("../evil.txt", Buffer.from("nope"));
      await writeFile(zipPath, zipBytes);

      await expect(restoreFromZip({ projectRoot: dir, zipPath })).rejects.toBeInstanceOf(UnsafeZipEntryError);
    });
  });
});

