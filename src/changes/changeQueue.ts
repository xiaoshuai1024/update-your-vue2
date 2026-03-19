import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Change } from "./changeTypes";

export interface ChangeQueueSummary {
  changes: Array<{ kind: Change["kind"]; path: string }>;
}

export class ChangeQueue {
  private readonly changes: Change[] = [];

  add(change: Change) {
    this.changes.push(change);
  }

  summary(): ChangeQueueSummary {
    return {
      changes: this.changes.map((c) => ({ kind: c.kind, path: c.path }))
    };
  }

  async apply(): Promise<void> {
    for (const change of this.changes) {
      if (change.kind === "mkdir") {
        await mkdir(change.path, { recursive: true });
        continue;
      }

      if (change.kind === "writeFile") {
        await mkdir(dirname(change.path), { recursive: true });
        await writeFile(change.path, change.content, "utf8");
        continue;
      }

      if (change.kind === "updateJson") {
        const raw = await readFile(change.path, "utf8");
        const current = JSON.parse(raw);
        const updated = change.updater(current);
        await mkdir(dirname(change.path), { recursive: true });
        await writeFile(change.path, JSON.stringify(updated, null, 2) + "\n", "utf8");
        continue;
      }

      // Exhaustiveness
      const _never: never = change;
      throw new Error(`Unknown change kind: ${(change as any).kind}`);
    }
  }
}

