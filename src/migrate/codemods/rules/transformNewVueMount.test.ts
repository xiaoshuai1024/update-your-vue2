import { describe, it, expect } from "vitest";
import { transformNewVueMount } from "./transformNewVueMount";

describe("transformNewVueMount", () => {
  it("transforms render: h => h(App) + import Vue default", () => {
    const input = `import Vue from "vue";
import App from "./App.vue";

new Vue({ render: h => h(App) }).$mount("#app")
`;

    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(true);
    expect(res.newContent).toContain(`import { createApp } from "vue";`);
    expect(res.newContent).toContain(`createApp(App).mount("#app");`);
    expect(res.newContent).not.toContain("new Vue");
    expect(res.notes).toEqual([]);
  });

  it("transforms render: function(h){ return h(App) } + import Vue default", () => {
    const input = `import Vue from 'vue';
import App from "./App.vue";

new Vue({ render: function(h){ return h(App) } }).$mount('#app');
`;

    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(true);
    expect(res.newContent).toContain(`import { createApp } from 'vue';`);
    expect(res.newContent).toContain(`createApp(App).mount('#app');`);
    expect(res.notes).toEqual([]);
  });

  it("adds createApp to existing named vue import", () => {
    const input = `import { nextTick } from "vue";
import App from "./App.vue";

new Vue({ render: h => h(App) }).$mount("#app");
`;
    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(true);
    expect(res.newContent).toContain(`import { createApp, nextTick } from "vue";`);
    expect(res.newContent).toContain(`createApp(App).mount("#app");`);
    expect(res.notes).toEqual([]);
  });

  it("inserts vue import if missing (after shebang)", () => {
    const input = `#!/usr/bin/env node
import App from "./App.vue";

new Vue({ render: h => h(App) }).$mount("#app");
`;
    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(true);
    expect(res.newContent?.startsWith(`#!/usr/bin/env node\nimport { createApp } from "vue";\n`)).toBe(true);
  });

  it("skips when multiple new Vue mount expressions exist", () => {
    const input = `import Vue from "vue";
import App from "./App.vue";

new Vue({ render: h => h(App) }).$mount("#app");
new Vue({ render: h => h(App) }).$mount("#app2");
`;
    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(false);
    expect(res.newContent).toBeUndefined();
    expect(res.notes.length).toBeGreaterThan(0);
  });

  it("skips when render function shape is not recognized", () => {
    const input = `import Vue from "vue";
import App from "./App.vue";

new Vue({ render: (h) => h(App) }).$mount("#app");
`;
    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(false);
    expect(res.newContent).toBeUndefined();
    expect(res.notes.length).toBeGreaterThan(0);
  });

  it("skips when $mount arg is complex (nested parens)", () => {
    const input = `import Vue from "vue";
import App from "./App.vue";

new Vue({ render: h => h(App) }).$mount(document.getElementById(getId()));
`;
    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(false);
    expect(res.notes.length).toBeGreaterThan(0);
  });

  it("skips when Vue identifier is still referenced (unsafe import rewrite)", () => {
    const input = `import Vue from "vue";
import App from "./App.vue";

Vue.use(function(){});
new Vue({ render: h => h(App) }).$mount("#app");
`;
    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(false);
    expect(res.notes.some((n) => n.message.includes("Vue identifier is still referenced"))).toBe(true);
  });

  it("skips when options object contains additional properties (nested braces risk)", () => {
    const input = `import Vue from "vue";
import App from "./App.vue";

new Vue({ render: h => h(App), methods: { a() {} } }).$mount("#app");
`;
    const res = transformNewVueMount.run({ filePath: "src/main.js", content: input, ctx: { projectRoot: "/tmp" } });
    expect(res.changed).toBe(false);
    expect(res.notes.length).toBeGreaterThan(0);
  });
});

