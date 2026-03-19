import { describe, it, expect } from "vitest";
import { planGenerateTypes } from "./generateTypes";

describe("planGenerateTypes", () => {
  it("returns no notes when disabled", () => {
    const plan = planGenerateTypes({
      target: "vite",
      useCompat: false,
      generateTypes: false,
      backup: true,
      install: false
    });
    expect(plan.notes.length).toBe(0);
  });

  it("returns notes when enabled", () => {
    const plan = planGenerateTypes({
      target: "vite",
      useCompat: false,
      generateTypes: true,
      backup: true,
      install: false
    });
    expect(plan.notes.length).toBeGreaterThan(0);
  });
});

