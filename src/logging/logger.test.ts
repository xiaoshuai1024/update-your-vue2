import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;

  beforeEach(() => {
    process.stdout.write = vi.fn() as any;
    process.stderr.write = vi.fn() as any;
  });

  afterEach(() => {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  });

  it("writes info to stdout by default", () => {
    const logger = createLogger("info");
    logger.info("hello");
    expect(process.stdout.write).toHaveBeenCalled();
  });

  it("only writes verbose logs in verbose mode", () => {
    const logger = createLogger("info");
    logger.verbose("v");
    expect(process.stdout.write).not.toHaveBeenCalled();
  });
});

