import { parse as babelParse } from "@babel/parser";
import type { ParserPlugin } from "@babel/parser";
import type { File } from "@babel/types";

/**
 * Parse script source into a Babel File AST.
 * Uses plugins based on file extension (typescript for .ts/.tsx, jsx for .jsx/.tsx).
 */
export function parseScript(source: string, filePath: string): File {
  const ext = filePath.includes(".") ? filePath.split(".").pop()!.toLowerCase() : "";
  const plugins: ParserPlugin[] = [];
  if (ext === "tsx" || ext === "ts") plugins.push("typescript");
  if (ext === "jsx" || ext === "tsx") plugins.push("jsx");

  return babelParse(source, {
    sourceType: "module",
    plugins: plugins.length > 0 ? plugins : undefined
  }) as File;
}
