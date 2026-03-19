import type { UpdateYourVue2Config } from "../../config/schema";
import type { ChangeQueue } from "../../changes/changeQueue";
import { applyViteScaffoldToQueue, planViteScaffold } from "./viteScaffold";
import { planWebpackBuild } from "./webpackPlan";

export interface BuildTargetPlan {
  notes: string[];
}

export function planBuildTarget(projectRoot: string, config: UpdateYourVue2Config, queue: ChangeQueue): BuildTargetPlan {
  if (config.target === "vite") {
    const plan = planViteScaffold(projectRoot);
    applyViteScaffoldToQueue(queue, plan);
    return { notes: plan.notes };
  }

  return { notes: planWebpackBuild().notes };
}

