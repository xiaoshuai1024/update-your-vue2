import { describe, expect, it } from "vitest";
import { parseScript } from "../parse";
import { print } from "../print";
import { transformNewVueMountAst } from "./transformNewVueMountAst";

describe("transformNewVueMountAst", () => {
  it("transforms new Vue mount to createApp mount", () => {
    const source = `import Vue from "vue";
import App from "./App.vue";
new Vue({ render: h => h(App) }).$mount("#app");
`;
    const ast = parseScript(source, "src/main.js");
    const res = transformNewVueMountAst.run({
      filePath: "src/main.js",
      ast,
      source,
      ctx: { projectRoot: "/tmp" }
    });

    expect(res.ast).toBeDefined();
    const out = print(res.ast!);
    expect(out).toContain(`import { createApp } from "vue";`);
    expect(out).toContain(`createApp(App).mount("#app");`);
    expect(out).not.toContain("new Vue");
  });

  it("returns note when Vue identifier is still referenced", () => {
    const source = `import Vue from "vue";
import App from "./App.vue";
Vue.use(foo);
new Vue({ render: h => h(App) }).$mount("#app");
`;
    const ast = parseScript(source, "src/main.js");
    const res = transformNewVueMountAst.run({
      filePath: "src/main.js",
      ast,
      source,
      ctx: { projectRoot: "/tmp" }
    });

    expect(res.ast).toBeUndefined();
    expect(res.notes.some((n) => n.message.includes("Vue identifier is still referenced"))).toBe(true);
  });
});

