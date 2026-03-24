import * as babelTraverse from "@babel/traverse";
import * as t from "@babel/types";
import type { AstCodemod } from "../types";

const traverse = (babelTraverse.default as any)?.default ?? babelTraverse.default;

function extractAppIdentifier(renderValue: t.Expression | t.SpreadElement | t.PrivateName | t.PatternLike): t.Identifier | null {
  if (t.isArrowFunctionExpression(renderValue)) {
    if (renderValue.params.length !== 1 || !t.isIdentifier(renderValue.params[0])) return null;
    const h = renderValue.params[0].name;
    if (!t.isCallExpression(renderValue.body) || !t.isIdentifier(renderValue.body.callee, { name: h })) return null;
    if (renderValue.body.arguments.length !== 1 || !t.isIdentifier(renderValue.body.arguments[0])) return null;
    return t.identifier(renderValue.body.arguments[0].name);
  }

  if (t.isFunctionExpression(renderValue)) {
    if (renderValue.params.length !== 1 || !t.isIdentifier(renderValue.params[0])) return null;
    const h = renderValue.params[0].name;
    const body = renderValue.body.body;
    if (body.length !== 1 || !t.isReturnStatement(body[0]) || !body[0].argument) return null;
    const ret = body[0].argument;
    if (!t.isCallExpression(ret) || !t.isIdentifier(ret.callee, { name: h })) return null;
    if (ret.arguments.length !== 1 || !t.isIdentifier(ret.arguments[0])) return null;
    return t.identifier(ret.arguments[0].name);
  }

  return null;
}

function extractAppIdentifierFromRenderMethod(method: t.ObjectMethod): t.Identifier | null {
  if (!t.isIdentifier(method.key, { name: "render" })) return null;
  if (method.params.length !== 1 || !t.isIdentifier(method.params[0])) return null;
  const h = method.params[0].name;
  const body = method.body.body;
  if (body.length !== 1 || !t.isReturnStatement(body[0]) || !body[0].argument) return null;
  const ret = body[0].argument;
  if (!t.isCallExpression(ret) || !t.isIdentifier(ret.callee, { name: h })) return null;
  if (ret.arguments.length !== 1 || !t.isIdentifier(ret.arguments[0])) return null;
  return t.identifier(ret.arguments[0].name);
}

function countVueIdentifierRefs(ast: t.File): number {
  let vueRefCount = 0;
  traverse(ast, {
    Identifier(path: any) {
      if (path.node.name !== "Vue") return;
      if (path.parentPath && path.parentPath.isImportDefaultSpecifier()) return;
      vueRefCount += 1;
    }
  });
  return vueRefCount;
}

function isVueDefaultImport(spec: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier): boolean {
  return t.isImportDefaultSpecifier(spec) && spec.local.name === "Vue";
}

function isVueNamespaceImport(spec: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier): boolean {
  return t.isImportNamespaceSpecifier(spec) && spec.local.name === "Vue";
}

function isVueConfigProductionTipAssignmentStatement(stmt: t.Statement): boolean {
  if (!t.isExpressionStatement(stmt)) return false;
  const expr = stmt.expression;
  if (!t.isAssignmentExpression(expr) || expr.operator !== "=") return false;
  if (!t.isMemberExpression(expr.left)) return false;
  const productionTipProp = expr.left.property;
  if (!t.isIdentifier(productionTipProp, { name: "productionTip" })) return false;
  const configObj = expr.left.object;
  if (!t.isMemberExpression(configObj)) return false;
  if (!t.isIdentifier(configObj.property, { name: "config" })) return false;
  return t.isIdentifier(configObj.object, { name: "Vue" });
}

export const transformNewVueMountAst: AstCodemod = {
  name: "transform-new-vue-mount-ast",
  run: ({ filePath, ast }) => {
    const notes: Array<{ filePath: string; message: string }> = [];
    const candidates: Array<{
      stmtPath: any;
      appId: t.Identifier;
      mountArg: t.Expression | t.SpreadElement | t.ArgumentPlaceholder;
    }> = [];

    traverse(ast, {
      ExpressionStatement(path: any) {
        const expr = path.node.expression;
        if (!t.isCallExpression(expr)) return;
        if (!t.isMemberExpression(expr.callee)) return;
        if (!t.isIdentifier(expr.callee.property, { name: "$mount" })) return;

        const mountObj = expr.callee.object;
        if (!t.isNewExpression(mountObj)) return;
        if (!t.isIdentifier(mountObj.callee, { name: "Vue" })) return;
        if (mountObj.arguments.length !== 1 || !t.isObjectExpression(mountObj.arguments[0])) return;
        if (expr.arguments.length !== 1) return;

        const obj = mountObj.arguments[0];
        const renderProp = obj.properties.find((prop) => {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: "render" })) return true;
          if (t.isObjectMethod(prop) && t.isIdentifier(prop.key, { name: "render" })) return true;
          return false;
        });
        if (!renderProp) return;

        let appId: t.Identifier | null = null;
        if (t.isObjectProperty(renderProp)) {
          appId = extractAppIdentifier(renderProp.value as any);
        } else if (t.isObjectMethod(renderProp)) {
          appId = extractAppIdentifierFromRenderMethod(renderProp);
        }
        if (!appId) return;

        candidates.push({
          stmtPath: path,
          appId,
          mountArg: expr.arguments[0]
        });
      }
    });

    if (candidates.length === 0) {
      return { notes };
    }
    if (candidates.length > 1) {
      notes.push({
        filePath,
        message: "Detected multiple new Vue(...).$mount(...) expressions; skipping AST transform."
      });
      return { notes };
    }

    const candidate = candidates[0];
    candidate.stmtPath.replaceWith(
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(t.callExpression(t.identifier("createApp"), [candidate.appId]), t.identifier("mount")),
          [candidate.mountArg]
        )
      )
    );

    // Vue 3 removed `Vue.config.productionTip`; keeping it causes runtime errors.
    ast.program.body = ast.program.body.filter((stmt) => !isVueConfigProductionTipAssignmentStatement(stmt));

    let hasCreateAppImport = false;
    const vueImportDecls: t.ImportDeclaration[] = [];
    let hasVueNamespaceImport = false;
    let hasVueDefaultImport = false;

    for (const stmt of ast.program.body) {
      if (!t.isImportDeclaration(stmt) || stmt.source.value !== "vue") continue;
      vueImportDecls.push(stmt);
      for (const spec of stmt.specifiers) {
        if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: "createApp" })) {
          hasCreateAppImport = true;
        }
        if (isVueNamespaceImport(spec)) {
          hasVueNamespaceImport = true;
        }
        if (isVueDefaultImport(spec)) {
          hasVueDefaultImport = true;
        }
      }
    }

    const vueRefCount = countVueIdentifierRefs(ast);
    if (vueRefCount > 0 && hasVueDefaultImport) {
      for (const decl of vueImportDecls) {
        decl.specifiers = decl.specifiers.filter((spec) => !isVueDefaultImport(spec));
      }
      ast.program.body = ast.program.body.filter((stmt) => {
        if (!t.isImportDeclaration(stmt) || stmt.source.value !== "vue") return true;
        return stmt.specifiers.length > 0;
      });
      if (!hasVueNamespaceImport) {
        ast.program.body.unshift(
          t.importDeclaration([t.importNamespaceSpecifier(t.identifier("Vue"))], t.stringLiteral("vue"))
        );
      }
    } else if (vueRefCount === 0) {
      for (const decl of vueImportDecls) {
        decl.specifiers = decl.specifiers.filter((spec) => !isVueDefaultImport(spec));
      }
      ast.program.body = ast.program.body.filter((stmt) => {
        if (!t.isImportDeclaration(stmt) || stmt.source.value !== "vue") return true;
        return stmt.specifiers.length > 0;
      });
    }

    let firstVueImportDecl: t.ImportDeclaration | null = null;
    for (const stmt of ast.program.body) {
      if (!t.isImportDeclaration(stmt) || stmt.source.value !== "vue") continue;
      firstVueImportDecl = stmt;
      for (const spec of stmt.specifiers) {
        if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: "createApp" })) {
          hasCreateAppImport = true;
        }
      }
      if (hasCreateAppImport) break;
    }
    if (!hasCreateAppImport) {
      if (firstVueImportDecl && firstVueImportDecl.specifiers.every((s) => !t.isImportNamespaceSpecifier(s))) {
        firstVueImportDecl.specifiers.push(
          t.importSpecifier(t.identifier("createApp"), t.identifier("createApp"))
        );
      } else {
        ast.program.body.unshift(
          t.importDeclaration([t.importSpecifier(t.identifier("createApp"), t.identifier("createApp"))], t.stringLiteral("vue"))
        );
      }
    }

    return { ast, notes };
  }
};

