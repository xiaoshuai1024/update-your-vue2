import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import fg from "fast-glob";
import type { Codemod, CodemodNote } from "./types";
import type { AstCodemod } from "../ast/types";
import { parseScript } from "../ast/parse";
import { print } from "../ast/print";
import { parseSfc, reassembleSfc } from "../ast/sfc";

export interface RunCodemodsOptions {
  projectRoot: string;
  codemods: Codemod[];
  astCodemods?: AstCodemod[];
  globs?: string[];
  ignore?: string[];
  includeDefaultIgnores?: boolean;
}

export interface CodemodEdit {
  filePath: string;
  newContent: string;
}

export interface RunCodemodsResult {
  edits: CodemodEdit[];
  notes: CodemodNote[];
  filesScanned: number;
}

function toPosixPath(p: string): string {
  return p.replaceAll("\\", "/");
}

const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/coverage/**",
  "**/.update-your-vue2/**"
];
const AST_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function inferExtFromScriptLang(lang: string): string {
  const l = lang.toLowerCase();
  if (l === "ts") return ".ts";
  if (l === "tsx") return ".tsx";
  if (l === "jsx") return ".jsx";
  return ".js";
}

function runAstCodemodsForScript(args: {
  filePath: string;
  scriptContent: string;
  scriptExt: string;
  projectRoot: string;
  astCodemods: AstCodemod[];
  notes: CodemodNote[];
}): { handledByAst: boolean; content: string } {
  let ast = parseScript(args.scriptContent, `${args.filePath}${args.scriptExt}`);
  let astChanged = false;
  for (const mod of args.astCodemods) {
    const res = mod.run({ filePath: args.filePath, ast, source: args.scriptContent, ctx: { projectRoot: args.projectRoot } });
    args.notes.push(...res.notes);
    if (res.ast) {
      ast = res.ast;
      astChanged = true;
    }
  }
  if (!astChanged) return { handledByAst: false, content: args.scriptContent };
  return { handledByAst: true, content: print(ast) };
}

function runStringCodemodsForFile(args: {
  filePath: string;
  rel: string;
  ext: string;
  content: string;
  projectRoot: string;
  codemods: Codemod[];
  notes: CodemodNote[];
}): string {
  let content = args.content;
  for (const mod of args.codemods) {
    if (!mod.fileExtensions.includes(args.ext)) continue;
    const res = mod.run({
      filePath: args.filePath,
      content,
      ctx: { projectRoot: args.projectRoot }
    });
    args.notes.push(...res.notes);
    if (res.changed) {
      if (typeof res.newContent !== "string") {
        throw new Error(`Codemod "${mod.name}" reported changed=true but returned no newContent for ${args.rel}`);
      }
      content = res.newContent;
    }
  }
  return content;
}

export async function runCodemods(options: RunCodemodsOptions): Promise<RunCodemodsResult> {
  const projectRoot = resolve(options.projectRoot);
  const patterns = options.globs ?? ["**/*.{js,jsx,ts,tsx,vue}"];
  const ignore = [
    ...(options.includeDefaultIgnores === false ? [] : DEFAULT_IGNORES),
    ...(options.ignore ?? [])
  ];
  const files = await fg(patterns, {
    cwd: projectRoot,
    dot: true,
    ignore,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  const notes: CodemodNote[] = [];
  const edits: CodemodEdit[] = [];
  const astCodemods = options.astCodemods ?? [];

  for (const rel of files) {
    const abs = resolve(projectRoot, rel);
    const originalContent = await readFile(abs, "utf8");
    let content = originalContent;
    const ext = rel.includes(".") ? "." + rel.split(".").pop()!.toLowerCase() : "";
    const filePath = toPosixPath(relative(projectRoot, abs));
    let handledByAst = false;

    if (AST_EXTENSIONS.has(ext) && astCodemods.length > 0) {
      try {
        const astResult = runAstCodemodsForScript({
          filePath,
          scriptContent: content,
          scriptExt: ext,
          projectRoot,
          astCodemods,
          notes
        });
        handledByAst = astResult.handledByAst;
        content = astResult.content;
      } catch (err) {
        notes.push({
          filePath,
          message: `AST parse failed, fallback to string codemods: ${String(err instanceof Error ? err.message : err)}`
        });
      }
    }

    if (ext === ".vue" && astCodemods.length > 0) {
      try {
        const parsed = parseSfc(content, filePath);
        if (parsed.script) {
          const scriptExt = inferExtFromScriptLang(parsed.script.lang);
          const astResult = runAstCodemodsForScript({
            filePath,
            scriptContent: parsed.script.content,
            scriptExt,
            projectRoot,
            astCodemods,
            notes
          });
          if (astResult.handledByAst) {
            content = reassembleSfc(parsed, astResult.content);
            handledByAst = true;
          }
        }
      } catch (err) {
        notes.push({
          filePath,
          message: `AST parse failed, fallback to string codemods: ${String(err instanceof Error ? err.message : err)}`
        });
      }
    }

    if (!handledByAst) {
      content = runStringCodemodsForFile({
        filePath,
        rel,
        ext,
        content,
        projectRoot,
        codemods: options.codemods,
        notes
      });
    }

    if (content !== originalContent) {
      edits.push({ filePath, newContent: content });
    }
  }

  return { edits, notes, filesScanned: files.length };
}

