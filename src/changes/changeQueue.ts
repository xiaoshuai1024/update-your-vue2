import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Change } from "./changeTypes";

export interface ChangeQueueSummary {
  changes: Array<{ kind: Change["kind"]; path: string }>;
}

export type ChangeQueuePreflightResult = { ok: true } | { ok: false; reason: string };

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

  preflight(): ChangeQueuePreflightResult {
    const seen = new Map<string, Change["kind"][]>();
    for (const change of this.changes) {
      const kinds = seen.get(change.path) ?? [];
      const nextKinds = [...kinds, change.kind];
      seen.set(change.path, nextKinds);
      if (nextKinds.length <= 1) continue;

      const allUpdateJson = nextKinds.every((k) => k === "updateJson");
      if (!allUpdateJson) {
        return {
          ok: false,
          reason: `Duplicate change target detected: ${change.path}`
        };
      }
    }
    return { ok: true };
  }

  async apply(): Promise<void> {
    const preflight = this.preflight();
    if (!preflight.ok) {
      throw new Error(`Change preflight failed: ${preflight.reason}`);
    }

    for (const change of this.changes) {
      try {
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
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Apply failed at ${change.kind} ${change.path}: ${errMsg}. Stop further changes. You can recover with \`update-your-vue2 restore\`.`
        );
      }
    }
  }
}

