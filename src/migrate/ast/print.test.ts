import { describe, expect, it } from "vitest";
import { parseScript } from "./parse";
import { print } from "./print";

describe("print", () => {
  it("returns string for AST", () => {
    const ast = parseScript("const x = 1;", "main.js");
    const out = print(ast);
    expect(typeof out).toBe("string");
    expect(out).toContain("x");
    expect(out).toContain("1");
  });

  it("round-trips: parse(print(ast)) preserves structure", () => {
    const source = "const x = 1;";
    const ast = parseScript(source, "main.js");
    const printed = print(ast);
    const roundTrip = parseScript(printed, "main.js");
    expect(roundTrip.program.body.length).toBe(ast.program.body.length);
    expect(roundTrip.type).toBe("File");
  });
});
