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
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  // Adjust when deploying under a sub-path.
  base: "/"
});
`;

  return {
    files: [{ path: viteConfigPath, content }],
    notes: [
      "Vite scaffold generated with alias/base defaults: review env vars, static asset handling, and publicPath/base migration."
    ]
  };
}

export function applyViteScaffoldToQueue(queue: ChangeQueue, plan: ViteScaffoldPlan) {
  for (const file of plan.files) {
    queue.add({ kind: "writeFile", path: file.path, content: file.content });
  }
}

