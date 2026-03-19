import type { UpdateYourVue2Config } from "../../config/schema";

export interface GenerateTypesPlan {
  notes: string[];
}

export function planGenerateTypes(config: UpdateYourVue2Config): GenerateTypesPlan {
  if (!config.generateTypes) {
    return { notes: [] };
  }

  return {
    notes: [
      "generateTypes=true: MVP does not auto-run tsc yet.",
      "If your project uses TypeScript, consider running: `npx tsc --declaration --emitDeclarationOnly` (or your existing build script).",
      "If your project does not use TypeScript, you may need to add Vue SFC shims (e.g. shims-vue.d.ts)."
    ]
  };
}

