import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeQueue } from "../../changes/changeQueue";

export interface ViteScaffoldPlan {
  files: Array<{ path: string; content: string }>;
  notes: string[];
}

const MAIN_CANDIDATES = ["main.ts", "main.tsx", "main.js", "main.jsx"] as const;

/** Resolves which `src/main.*` file to reference from the root index.html. */
export function resolveSrcMainEntry(projectRoot: string): { fileName: string; guessed: boolean } {
  const srcDir = join(projectRoot, "src");
  for (const name of MAIN_CANDIDATES) {
    if (existsSync(join(srcDir, name))) {
      return { fileName: name, guessed: false };
    }
  }
  return { fileName: "main.js", guessed: true };
}

function readPackageTitle(projectRoot: string): string {
  try {
    const pkgPath = join(projectRoot, "package.json");
    if (!existsSync(pkgPath)) return "App";
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    if (typeof pkg.name === "string" && pkg.name.length > 0) return pkg.name;
  } catch {
    // ignore
  }
  return "App";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRootIndexHtml(projectRoot: string): { content: string; notes: string[] } {
  const { fileName, guessed } = resolveSrcMainEntry(projectRoot);
  const title = escapeHtml(readPackageTitle(projectRoot));
  const scriptSrc = `/src/${fileName}`;
  const content = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${scriptSrc}"></script>
  </body>
</html>
`;
  const notes: string[] = [
    "Vite uses the project-root `index.html` as the dev/build HTML entry (not `public/index.html`).",
    guessed
      ? `No \`src/main.{ts,tsx,js,jsx}\` found; scaffold references \`${scriptSrc}\` — verify or adjust.`
      : `Root \`index.html\` points to \`${scriptSrc}\`.`
  ];
  return { content, notes };
}

export function planViteScaffold(projectRoot: string): ViteScaffoldPlan {
  const viteConfigPath = join(projectRoot, "vite.config.ts");
  const viteConfigContent = `import { defineConfig } from "vite";
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

  const rootIndexPath = join(projectRoot, "index.html");
  const files: Array<{ path: string; content: string }> = [{ path: viteConfigPath, content: viteConfigContent }];

  const notes: string[] = [
    "Vite scaffold generated with alias/base defaults: review env vars, static asset handling, and publicPath/base migration."
  ];

  if (existsSync(rootIndexPath)) {
    notes.push(
      "Root `index.html` already exists; not overwritten. Ensure it includes a Vite module entry (e.g. `<script type=\"module\" src=\"/src/main.js\">`)."
    );
  } else {
    const { content, notes: indexNotes } = buildRootIndexHtml(projectRoot);
    files.push({ path: rootIndexPath, content });
    notes.push(...indexNotes);
  }

  return { files, notes };
}

export function applyViteScaffoldToQueue(queue: ChangeQueue, plan: ViteScaffoldPlan) {
  for (const file of plan.files) {
    queue.add({ kind: "writeFile", path: file.path, content: file.content });
  }
}
