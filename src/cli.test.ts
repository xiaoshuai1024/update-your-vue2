import { describe, it, expect, vi, beforeEach } from "vitest";

const loadConfigMock = vi.fn();
const planDependencyUpgradeMock = vi.fn();
const applyDependencyUpgradeToQueueMock = vi.fn();
const planScriptsMigrationMock = vi.fn();
const applyScriptsMigrationToQueueMock = vi.fn();
const runInstallMock = vi.fn();
const detectPackageManagerMock = vi.fn(async () => "npm");
const backupProjectMock = vi.fn();
const restoreFromZipMock = vi.fn();

vi.mock("./config/loadConfig", () => ({
  loadConfig: loadConfigMock
}));

vi.mock("./migrate/deps/upgradeDependencies", () => ({
  planDependencyUpgrade: planDependencyUpgradeMock,
  applyDependencyUpgradeToQueue: applyDependencyUpgradeToQueueMock
}));
vi.mock("./migrate/scripts/planScriptsMigration", () => ({
  planScriptsMigration: planScriptsMigrationMock,
  applyScriptsMigrationToQueue: applyScriptsMigrationToQueueMock
}));

vi.mock("./migrate/build/updateBuildTarget", () => ({
  planBuildTarget: vi.fn(() => ({ notes: [] }))
}));

vi.mock("./migrate/codemods/runner", () => ({
  runCodemods: vi.fn(async () => ({ edits: [], notes: [], filesScanned: 0 }))
}));

vi.mock("./migrate/types/generateTypes", () => ({
  planGenerateTypes: vi.fn(() => ({ notes: [] }))
}));

vi.mock("./backup/backupProject", () => ({
  backupProject: backupProjectMock
}));
vi.mock("./restore/restoreFromZip", () => ({
  restoreFromZip: restoreFromZipMock
}));
vi.mock("./scan/detectPackageManager", () => ({
  detectPackageManager: detectPackageManagerMock
}));
vi.mock("./install/runInstall", () => ({
  runInstall: runInstallMock
}));

vi.mock("./report/report", () => ({
  writeReportMd: vi.fn(async () => undefined)
}));

vi.mock("./logging/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    verbose: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

describe("cli", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    planDependencyUpgradeMock.mockReset();
    applyDependencyUpgradeToQueueMock.mockReset();
    planScriptsMigrationMock.mockReset();
    applyScriptsMigrationToQueueMock.mockReset();
    runInstallMock.mockReset();
    detectPackageManagerMock.mockClear();
    backupProjectMock.mockReset();
    restoreFromZipMock.mockReset();
    backupProjectMock.mockResolvedValue({ includedFiles: [], excludedCount: 0, includedBytes: 0 });
    restoreFromZipMock.mockResolvedValue({ filesPlanned: [] });
  });

  it('treats "dry-run" argument as --dry-run', async () => {
    const cwd = process.cwd();

    loadConfigMock.mockImplementation(async (projectRootInput: string) => ({
      projectRoot: projectRootInput,
      configPathTried: "",
      config: {
        target: "vite",
        useCompat: false,
        generateTypes: false,
        backup: false,
        install: false
      }
    }));

    planDependencyUpgradeMock.mockResolvedValue({
      packageJsonPath: "",
      changes: [],
      notes: []
    });
    planScriptsMigrationMock.mockResolvedValue({ packageJsonPath: "", changed: false, notes: [] });

    const { main } = await import("./cli");
    await main(["node", "update-your-vue2", "dry-run"]);

    expect(loadConfigMock).toHaveBeenCalled();
    expect(loadConfigMock.mock.calls[0][0]).toBe(cwd);
  });

  it("runs install when config install=true", async () => {
    const cwd = process.cwd();
    loadConfigMock.mockResolvedValue({
      projectRoot: cwd,
      configPathTried: "",
      config: { target: "vite", useCompat: false, generateTypes: false, backup: false, install: true }
    });
    planDependencyUpgradeMock.mockResolvedValue({ packageJsonPath: "", changes: [], notes: [] });
    planScriptsMigrationMock.mockResolvedValue({ packageJsonPath: "", changed: false, notes: [] });

    const { main } = await import("./cli");
    await main(["node", "update-your-vue2"]);
    expect(detectPackageManagerMock).toHaveBeenCalledWith(cwd);
    expect(runInstallMock).toHaveBeenCalledWith({ pm: "npm", cwd });
  });

  it("creates pre-backup before restore by default", async () => {
    const cwd = process.cwd();
    backupProjectMock.mockResolvedValue({ zipPath: `${cwd}/pre.zip`, includedFiles: [], excludedCount: 0, includedBytes: 0 });
    restoreFromZipMock.mockResolvedValue({ filesPlanned: [] });

    const { main } = await import("./cli");
    await main(["node", "update-your-vue2", "restore", cwd, "--zip", "x.zip", "--force"]);
    expect(backupProjectMock).toHaveBeenCalled();
    expect(restoreFromZipMock).toHaveBeenCalled();
  });
});

