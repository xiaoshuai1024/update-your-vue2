export interface CodemodContext {
  projectRoot: string;
}

export interface CodemodNote {
  filePath: string;
  message: string;
}

export interface CodemodResult {
  changed: boolean;
  newContent?: string;
  notes: CodemodNote[];
}

export interface Codemod {
  name: string;
  fileExtensions: string[]; // e.g. [".js", ".ts", ".vue"]
  run: (args: { filePath: string; content: string; ctx: CodemodContext }) => CodemodResult;
}

