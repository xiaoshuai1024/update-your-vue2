import { parse } from "@vue/compiler-sfc";
import type { SFCBlock } from "@vue/compiler-sfc";

export interface ParsedSfcScript {
  content: string;
  lang: string;
  block: SFCBlock;
}

export interface ParsedSfc {
  source: string;
  script: ParsedSfcScript | null;
}

export function parseSfc(source: string, filePath: string): ParsedSfc {
  const { descriptor, errors } = parse(source, { filename: filePath });
  if (errors.length > 0) {
    throw new Error(`Failed to parse SFC: ${String(errors[0])}`);
  }

  const scriptBlock = descriptor.script ?? descriptor.scriptSetup ?? null;
  if (!scriptBlock) return { source, script: null };

  return {
    source,
    script: {
      content: scriptBlock.content,
      lang: scriptBlock.lang ?? "js",
      block: scriptBlock
    }
  };
}

export function reassembleSfc(parsed: ParsedSfc, newScriptContent: string): string {
  if (!parsed.script) return parsed.source;
  const start = parsed.script.block.loc.start.offset;
  const end = parsed.script.block.loc.end.offset;
  return `${parsed.source.slice(0, start)}${newScriptContent}${parsed.source.slice(end)}`;
}

