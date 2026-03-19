export interface WebpackBuildPlan {
  notes: string[];
}

export function planWebpackBuild(): WebpackBuildPlan {
  return {
    notes: [
      "target=webpack: conservative mode keeps existing webpack config unchanged.",
      "Review Vue 3 compatibility for loaders/plugins and consider migrating to Vite if possible."
    ]
  };
}

