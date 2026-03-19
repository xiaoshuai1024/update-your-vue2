import { describe, expect, it } from "vitest";
import { parseScript } from "./parse";

describe("parseScript", () => {
  it("returns AST for valid JS", () => {
    const ast = parseScript("const x = 1;", "main.js");
    expect(ast).toBeDefined();
    expect(ast.type).toBe("File");
    expect(ast.program).toBeDefined();
    expect(ast.program.type).toBe("Program");
  });

  it("throws for invalid JS", () => {
    expect(() => parseScript("const x = ", "main.js")).toThrow();
  });
});
