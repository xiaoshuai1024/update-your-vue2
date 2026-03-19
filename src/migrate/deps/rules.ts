export interface DependencyRulesInput {
  target: "vite" | "webpack";
  useCompat: boolean;
}

export interface DependencyChange {
  name: string;
  from?: string;
  to: string;
  section: "dependencies" | "devDependencies";
}

export interface DependencyRulesResult {
  changes: DependencyChange[];
  notes: string[];
}

function getDep(map: Record<string, string> | undefined, name: string): string | undefined {
  const v = map?.[name];
  return typeof v === "string" ? v : undefined;
}

export function computeDependencyRules(
  pkg: any,
  input: DependencyRulesInput
): DependencyRulesResult {
  const deps: Record<string, string> = { ...(pkg?.dependencies ?? {}) };
  const devDeps: Record<string, string> = { ...(pkg?.devDependencies ?? {}) };

  const changes: DependencyChange[] = [];
  const notes: string[] = [];

  const set = (section: "dependencies" | "devDependencies", name: string, to: string) => {
    const from = section === "dependencies" ? getDep(deps, name) : getDep(devDeps, name);
    if (from === to) return;
    changes.push({ name, from, to, section });
  };

  if (input.useCompat) {
    set("dependencies", "vue", "^3");
    set("dependencies", "@vue/compat", "^3");
    notes.push("useCompat=true: you likely need to configure compat mode flags and fix deprecation warnings.");
  } else {
    set("dependencies", "vue", "^3");
  }

  // Vue Router: if present, upgrade major.
  const routerFrom = getDep(deps, "vue-router") ?? getDep(devDeps, "vue-router");
  if (routerFrom) {
    set(getDep(deps, "vue-router") ? "dependencies" : "devDependencies", "vue-router", "^4");
  }

  // Build target deps (MVP).
  if (input.target === "vite") {
    set("devDependencies", "vite", "^6");
    set("devDependencies", "@vitejs/plugin-vue", "^5");
    notes.push("target=vite: please review env/aliases/static assets differences when migrating from webpack.");
  } else {
    notes.push("target=webpack: build config migration is not fully automated yet (MVP).");
  }

  // Vuex -> Pinia is not a mechanical dependency swap.
  const hasVuex = Boolean(getDep(deps, "vuex") ?? getDep(devDeps, "vuex"));
  if (hasVuex) {
    notes.push("Detected vuex: migration to Pinia is not automatic in MVP; expect manual work.");
  }

  return { changes, notes };
}

