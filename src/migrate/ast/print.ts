import * as babelGenerate from "@babel/generator";
import type { File } from "@babel/types";

const generate = (babelGenerate.default as any)?.default ?? babelGenerate.default;

/**
 * Print a Babel File AST back to source string.
 */
export function print(ast: File): string {
  const out = generate(ast, { retainLines: false }, undefined);
  return out.code;
}
