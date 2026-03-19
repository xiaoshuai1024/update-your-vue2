import type { File } from "@babel/types";

import type { CodemodNote } from "../codemods/types";

export interface AstCodemodContext {
  projectRoot: string;
}

export interface AstCodemodInput {
  filePath: string;
  ast: File;
  source: string;
  ctx: AstCodemodContext;
}

export interface AstCodemodResult {
  ast?: File;
  notes: CodemodNote[];
}

export interface AstCodemod {
  name: string;
  run: (input: AstCodemodInput) => AstCodemodResult;
}
