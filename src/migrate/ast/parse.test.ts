import { describe, expect, it } from "vitest";
import { parseScript } from "./parse";
import { print } from "./print";
import * as babelTraverse from "@babel/traverse";

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

describe("babel ESM imports", () => {
  it("traverse can be called with AST", () => {
    const ast = parseScript("const x = 1;", "test.js");
    const traverse = (babelTraverse as any).default?.default ?? babelTraverse.default;
    const visited: string[] = [];
    traverse(ast, {
      Identifier(path: any) {
        visited.push(path.node.name);
      }
    });
    expect(visited).toContain("x");
  });

  it("print produces valid output", () => {
    const ast = parseScript("const x = 1;", "test.js");
    const output = print(ast);
    expect(output).toContain("const");
    expect(output).toContain("x");
  });
});
