import type { Codemod } from "./types";
import { detectVue2GlobalApis } from "./rules/detectVue2GlobalApis";

export const DEFAULT_CODEMODS: Codemod[] = [detectVue2GlobalApis];

