import { describe, it, expect, vi, beforeEach } from "vitest";

const loadConfigMock = vi.fn();
const planDependencyUpgradeMock = vi.fn();
const applyDependencyUpgradeToQueueMock = vi.fn();

vi.mock("./config/loadConfig", () => ({
  loadConfig: (...args: any[]) => loadConfigMock(...args)
}));

vi.mock("./migrate/deps/upgradeDependencies", () => ({
  planDependencyUpgrade: (...args: any[]) => planDependencyUpgradeMock(...args),
  applyDependencyUpgradeToQueue: (...args: any[]) => applyDependencyUpgradeToQueueMock(...args)
}));

vi.mock("./backup/backupProject", () => ({
  backupProject: vi.fn(async () => ({ includedFiles: [], excludedCount: 0, includedBytes: 0 }))
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

    const { main } = await import("./cli");
    await main(["node", "update-your-vue2", "dry-run"]);

    expect(loadConfigMock).toHaveBeenCalled();
    expect(loadConfigMock.mock.calls[0][0]).toBe(cwd);
  });
});

