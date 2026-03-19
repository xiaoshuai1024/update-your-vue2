import type { Codemod } from "./types";
import { detectVue2GlobalApis } from "./rules/detectVue2GlobalApis";
import { transformNewVueMount } from "./rules/transformNewVueMount";
import type { AstCodemod } from "../ast/types";
import { transformNewVueMountAst } from "../ast/rules/transformNewVueMountAst";

export const DEFAULT_CODEMODS: Codemod[] = [transformNewVueMount, detectVue2GlobalApis];
export const DEFAULT_AST_CODEMODS: AstCodemod[] = [transformNewVueMountAst];

