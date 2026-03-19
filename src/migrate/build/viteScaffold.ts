import { join } from "node:path";
import type { ChangeQueue } from "../../changes/changeQueue";

export interface ViteScaffoldPlan {
  files: Array<{ path: string; content: string }>;
  notes: string[];
}

export function planViteScaffold(projectRoot: string): ViteScaffoldPlan {
  const viteConfigPath = join(projectRoot, "vite.config.ts");
  const content = `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()]
});
`;

  return {
    files: [{ path: viteConfigPath, content }],
    notes: [
      "Vite scaffold generated: review aliases, env vars, and static asset handling when migrating from webpack."
    ]
  };
}

export function applyViteScaffoldToQueue(queue: ChangeQueue, plan: ViteScaffoldPlan) {
  for (const file of plan.files) {
    queue.add({ kind: "writeFile", path: file.path, content: file.content });
  }
}

