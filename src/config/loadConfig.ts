import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { DEFAULT_CONFIG } from "./defaultConfig";
import { UpdateYourVue2ConfigSchema, type UpdateYourVue2Config } from "./schema";

const JsonValueSchema = z.unknown();

export type CliConfigOverrides = Partial<UpdateYourVue2Config> & {
  configPath?: string;
};

export interface LoadedConfig {
  projectRoot: string;
  configPathTried: string;
  configPathUsed?: string;
  config: UpdateYourVue2Config;
}

async function readJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

export async function loadConfig(projectRootInput: string, overrides: CliConfigOverrides): Promise<LoadedConfig> {
  const projectRoot = resolve(projectRootInput);
  const defaultConfigPath = join(projectRoot, "update-your-vue2.json");
  const configPath = overrides.configPath ? resolve(projectRoot, overrides.configPath) : defaultConfigPath;

  let fileConfig: unknown | undefined;
  let configPathUsed: string | undefined;
  try {
    const json = await readJsonFile(configPath);
    fileConfig = JsonValueSchema.parse(json);
    configPathUsed = configPath;
  } catch (err: any) {
    // If the user explicitly provided a config path, failing to read it is an error.
    if (overrides.configPath) throw err;
  }

  const merged = {
    ...DEFAULT_CONFIG,
    ...(fileConfig && typeof fileConfig === "object" && fileConfig !== null ? (fileConfig as Record<string, unknown>) : {}),
    ...Object.fromEntries(Object.entries(overrides).filter(([k, v]) => k !== "configPath" && v !== undefined))
  };

  const parsed = UpdateYourVue2ConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw parsed.error;
  }

  return {
    projectRoot,
    configPathTried: configPath,
    configPathUsed,
    config: parsed.data
  };
}

