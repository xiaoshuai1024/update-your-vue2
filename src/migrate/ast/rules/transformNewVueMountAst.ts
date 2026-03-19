import traverse from "@babel/traverse";
import * as t from "@babel/types";
import type { AstCodemod } from "../types";

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

function isVueDefaultImport(spec: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier): boolean {
  return t.isImportDefaultSpecifier(spec) && spec.local.name === "Vue";
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
        if (obj.properties.length !== 1) return;
        const prop = obj.properties[0];
        if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key, { name: "render" })) return;

        const appId = extractAppIdentifier(prop.value as any);
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

    // Ensure we can safely drop Vue default import if it's only used by the target expression.
    let vueRefCount = 0;
    traverse(ast, {
      Identifier(path: any) {
        if (path.node.name !== "Vue") return;
        if (path.parentPath && path.parentPath.isImportDefaultSpecifier()) return;
        vueRefCount += 1;
      }
    });
    if (vueRefCount > 1) {
      notes.push({
        filePath,
        message: "Skipped AST new Vue() transform because Vue identifier is still referenced."
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

    let hasCreateAppImport = false;
    let vueImportDecl: t.ImportDeclaration | null = null;

    for (const stmt of ast.program.body) {
      if (!t.isImportDeclaration(stmt) || stmt.source.value !== "vue") continue;
      vueImportDecl = stmt;
      for (const spec of stmt.specifiers) {
        if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: "createApp" })) {
          hasCreateAppImport = true;
        }
      }
      stmt.specifiers = stmt.specifiers.filter((spec) => !isVueDefaultImport(spec));
    }

    if (vueImportDecl) {
      if (!hasCreateAppImport) {
        vueImportDecl.specifiers.unshift(
          t.importSpecifier(t.identifier("createApp"), t.identifier("createApp"))
        );
      }
      if (vueImportDecl.specifiers.length === 0) {
        ast.program.body = ast.program.body.filter((s) => s !== vueImportDecl);
      }
    } else {
      ast.program.body.unshift(
        t.importDeclaration([t.importSpecifier(t.identifier("createApp"), t.identifier("createApp"))], t.stringLiteral("vue"))
      );
    }

    return { ast, notes };
  }
};

