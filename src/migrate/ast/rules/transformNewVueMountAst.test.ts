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

    expect(res.ast).toBeDefined();
    const out = print(res.ast!);
    expect(out).toContain(`import { createApp } from "vue";`);
    expect(out).toContain(`import * as Vue from "vue";`);
    expect(out).toContain(`Vue.use(foo);`);
    expect(out).toContain(`createApp(App).mount("#app");`);
    expect(res.notes).toEqual([]);
  });

  it("transforms render object method form", () => {
    const source = `import Vue from "vue";
import App from "./App.vue";
new Vue({
  render(h) {
    return h(App);
  }
}).$mount("#app");
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
  });

  it("transforms when mount argument is an expression", () => {
    const source = `import Vue from "vue";
import App from "./App.vue";
new Vue({ render: (h) => h(App) }).$mount(document.querySelector("#app"));
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
    expect(out).toContain(`createApp(App).mount(document.querySelector("#app"));`);
    expect(out).not.toContain("new Vue");
  });

  it("removes Vue.config.productionTip assignment", () => {
    const source = `import Vue from "vue";
import App from "./App.vue";
Vue.config.productionTip = false;
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
    expect(out).not.toContain("Vue.config.productionTip");
    expect(out).toContain(`createApp(App).mount("#app");`);
  });
});

