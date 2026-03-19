#!/usr/bin/env node

import { Command } from "commander";
import { z } from "zod";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createLogger } from "./logging/logger";
import { loadConfig } from "./config/loadConfig";
import { backupProject } from "./backup/backupProject";
import { ChangeQueue } from "./changes/changeQueue";
import { writeReportMd } from "./report/report";
import { listBackups } from "./restore/listBackups";
import { restoreFromZip } from "./restore/restoreFromZip";
import { planDependencyUpgrade, applyDependencyUpgradeToQueue } from "./migrate/deps/upgradeDependencies";
import { planBuildTarget } from "./migrate/build/updateBuildTarget";
import { runCodemods } from "./migrate/codemods/runner";
import { DEFAULT_CODEMODS } from "./migrate/codemods";
import { planGenerateTypes } from "./migrate/types/generateTypes";

const TargetSchema = z.enum(["vite", "webpack"]);

function parseTarget(value: string): "vite" | "webpack" {
  const parsed = TargetSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid --target "${value}". Expected "vite" or "webpack".`);
  }
  return parsed.data;
}

export async function main(argv: string[]) {
  const program = new Command();

  program
    .name("update-your-vue2")
    .description("Upgrade Vue 2 projects to Vue 3.")
    .showHelpAfterError(true);

  program
    .command("restore")
    .description("Restore project files from a backup zip")
    .argument("[projectRoot]", "Project root (default: current directory)")
    .option("--backup-dir <path>", "Backup directory (default: .update-your-vue2/backups/)")
    .option("--zip <path>", "Path to a backup zip to restore (skips selection)")
    .option("--dry-run", "Print what would be restored without writing", false)
    .option("--force", "Skip confirmation prompt", false)
    .option("--verbose", "Verbose logging", false)
    .action(async (projectRootArg: string | undefined, options) => {
      const logger = createLogger(options.verbose ? "verbose" : "info");
      const projectRoot = resolve(projectRootArg ?? process.cwd());
      const backupDir = resolve(projectRoot, options.backupDir ?? ".update-your-vue2/backups");

      let zipPath: string | undefined = options.zip ? resolve(projectRoot, options.zip) : undefined;

      if (!zipPath) {
        const backups = await listBackups(backupDir);
        if (backups.length === 0) {
          throw new Error(`No backup zips found in ${backupDir}`);
        }

        logger.info("Available backups:");
        backups.slice(0, 20).forEach((b, idx) => {
          logger.info(`  [${idx + 1}] ${b.filename}`);
        });
        if (backups.length > 20) logger.info(`  ... (${backups.length - 20} more)`);

        const rl = createInterface({ input, output });
        try {
          const answer = await rl.question("Select backup number to restore: ");
          const choice = Number.parseInt(answer.trim(), 10);
          if (!Number.isFinite(choice) || choice < 1 || choice > backups.length) {
            throw new Error("Invalid selection.");
          }
          zipPath = backups[choice - 1].path;
        } finally {
          rl.close();
        }
      }

      if (!options.force && !options.dryRun) {
        const rl = createInterface({ input, output });
        try {
          const answer = await rl.question(`This will overwrite files in ${projectRoot}. Continue? (y/N) `);
          const ok = answer.trim().toLowerCase();
          if (ok !== "y" && ok !== "yes") {
            logger.info("Cancelled.");
            return;
          }
        } finally {
          rl.close();
        }
      }

      const res = await restoreFromZip({ projectRoot, zipPath, dryRun: options.dryRun });
      if (options.dryRun) {
        logger.info(`Dry run: would restore ${res.filesPlanned.length} files.`);
      } else {
        logger.info(`Restored ${res.filesPlanned.length} files from ${zipPath}`);
      }
    });

  program
    .description("Upgrade Vue 2 projects to Vue 3.")
    .argument("[projectRoot]", "Project root (default: current directory)")
    .option("--config <path>", "Path to config JSON (default: <projectRoot>/update-your-vue2.json)")
    .option("--dry-run", "Print planned changes without writing anything", false)
    .option("--target <vite|webpack>", "Build target (default: vite)", parseTarget, "vite")
    .option("--use-compat", "Use vue@compat (default: false)", false)
    .option("--generate-types", "Generate TypeScript declarations (default: false)", false)
    .option("--backup", "Create a backup zip before changes (default: true)", true)
    .option("--no-backup", "Disable backup zip")
    .option("--backup-dir <path>", "Backup output directory (default: .update-your-vue2/backups/)")
    .option("--install", "Run package manager install (default: false)", false)
    .option("--no-install", "Disable install even if config enables it")
    .option("--verbose", "Verbose logging", false);

  program.action(async (projectRootArg: string | undefined, options) => {
    const logger = createLogger(options.verbose ? "verbose" : "info");

    // Common typo: users run `update-your-vue2 dry-run` instead of `--dry-run`.
    // Treat `dry-run` as an alias for the flag.
    if (projectRootArg === "dry-run" && options.dryRun !== true) {
      options.dryRun = true;
      projectRootArg = undefined;
    }

    const projectRoot = projectRootArg ?? process.cwd();
    const loaded = await loadConfig(projectRoot, {
      configPath: options.config,
      target: options.target,
      useCompat: options.useCompat,
      generateTypes: options.generateTypes,
      backup: options.backup,
      backupDir: options.backupDir,
      install: options.install
    });

    logger.verbose(`projectRoot=${loaded.projectRoot}`);
    logger.verbose(`configPathTried=${loaded.configPathTried}`);
    logger.verbose(`configPathUsed=${loaded.configPathUsed ?? "(none)"}`);
    logger.verbose(`dryRun=${options.dryRun}`);
    logger.verbose(`mergedConfig=${JSON.stringify(loaded.config)}`);

    if (options.dryRun) {
      logger.info("Dry run: no files will be modified.");
      if (loaded.config.backup) {
        const backupDir = loaded.config.backupDir ?? ".update-your-vue2/backups";
        const backup = await backupProject({
          projectRoot: loaded.projectRoot,
          backupDir,
          dryRun: true
        });
        logger.info(
          `Backup plan: include ${backup.includedFiles.length} files, exclude ${backup.excludedCount} files.`
        );
      }
      const queue = new ChangeQueue();
      const depPlan = await planDependencyUpgrade(loaded.projectRoot, loaded.config);
      applyDependencyUpgradeToQueue(queue, depPlan);
      const buildPlan = planBuildTarget(loaded.projectRoot, loaded.config, queue);
      const codemodRes = await runCodemods({ projectRoot: loaded.projectRoot, codemods: DEFAULT_CODEMODS });
      const typesPlan = planGenerateTypes(loaded.config);
      logger.info(`Planned changes: ${queue.summary().changes.length}`);
      if (depPlan.changes.length) {
        logger.info("Planned dependency changes:");
        depPlan.changes.forEach((c) => logger.info(`- ${c.section}.${c.name}: ${c.from ?? "(missing)"} -> ${c.to}`));
      }
      if (depPlan.notes.length) {
        logger.info("Notes:");
        depPlan.notes.forEach((n) => logger.info(`- ${n}`));
      }
      if (buildPlan.notes.length) {
        logger.info("Build notes:");
        buildPlan.notes.forEach((n) => logger.info(`- ${n}`));
      }
      if (codemodRes.notes.length) {
        logger.info(`Codemod notes (${codemodRes.notes.length}):`);
        codemodRes.notes.slice(0, 20).forEach((n) => logger.info(`- ${n.filePath}: ${n.message}`));
        if (codemodRes.notes.length > 20) logger.info(`- ... (${codemodRes.notes.length - 20} more)`);
      }
      if (typesPlan.notes.length) {
        logger.info("Types notes:");
        typesPlan.notes.forEach((n) => logger.info(`- ${n}`));
      }
    } else {
      if (loaded.config.backup) {
        const backupDir = loaded.config.backupDir ?? ".update-your-vue2/backups";
        logger.info("Creating backup zip...");
        const backup = await backupProject({
          projectRoot: loaded.projectRoot,
          backupDir
        });
        logger.info(`Backup created: ${backup.zipPath}`);
      }
      const queue = new ChangeQueue();
      const depPlan = await planDependencyUpgrade(loaded.projectRoot, loaded.config);
      applyDependencyUpgradeToQueue(queue, depPlan);
      const buildPlan = planBuildTarget(loaded.projectRoot, loaded.config, queue);
      const codemodRes = await runCodemods({ projectRoot: loaded.projectRoot, codemods: DEFAULT_CODEMODS });
      const typesPlan = planGenerateTypes(loaded.config);
      await queue.apply();

      await writeReportMd(join(loaded.projectRoot, "migration-report.md"), {
        title: "Vue2 → Vue3 Migration Report",
        sections: [
          {
            title: "Summary",
            body: "- (scaffold) Migration steps are not implemented yet."
          },
          {
            title: "Dependencies",
            body:
              depPlan.changes.length === 0
                ? "- No dependency changes planned."
                : depPlan.changes.map((c) => `- \`${c.section}.${c.name}\`: \`${c.from ?? "(missing)"}\` → \`${c.to}\``).join("\n")
          },
          {
            title: "Build",
            body: buildPlan.notes.length ? buildPlan.notes.map((n) => `- ${n}`).join("\n") : "- (none)"
          },
          {
            title: "Codemods",
            body:
              codemodRes.notes.length === 0
                ? "- (none)"
                : codemodRes.notes.map((n) => `- \`${n.filePath}\`: ${n.message}`).join("\n")
          },
          {
            title: "Types",
            body: typesPlan.notes.length ? typesPlan.notes.map((n) => `- ${n}`).join("\n") : "- (none)"
          },
          {
            title: "Notes",
            body: depPlan.notes.length ? depPlan.notes.map((n) => `- ${n}`).join("\n") : "- (none)"
          }
        ]
      });
      logger.info("Note: migration steps are not implemented yet (scaffold only).");
    }
  });

  await program.parseAsync(argv);
}

void main(process.argv).catch((err) => {
  process.stderr.write(`${String(err?.stack ?? err)}\n`);
  process.exitCode = 1;
});

