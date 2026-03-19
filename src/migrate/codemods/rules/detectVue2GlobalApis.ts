import type { Codemod } from "../types";

const SUSPICIOUS = [
  { needle: "Vue.use(", message: "Detected Vue.use(...): plugin registration differs in Vue 3 (createApp().use)." },
  { needle: "new Vue(", message: "Detected new Vue(...): Vue 3 uses createApp(...)." },
  { needle: "Vue.prototype", message: "Detected Vue.prototype: use app.config.globalProperties in Vue 3." }
];

export const detectVue2GlobalApis: Codemod = {
  name: "detect-vue2-global-apis",
  fileExtensions: [".js", ".ts", ".jsx", ".tsx"],
  run: ({ filePath, content }) => {
    const notes = [];
    for (const s of SUSPICIOUS) {
      if (content.includes(s.needle)) {
        notes.push({ filePath, message: s.message });
      }
    }
    return { changed: false, notes };
  }
};

