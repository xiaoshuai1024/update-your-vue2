import { describe, expect, it } from "vitest";
import { parseSfc, reassembleSfc } from "./sfc";

describe("sfc helpers", () => {
  it("extracts script content and lang", () => {
    const source = `<template><div>Hello</div></template>
<script lang="ts">
const x = 1;
</script>
<style scoped>.a { color: red; }</style>
`;
    const parsed = parseSfc(source, "Comp.vue");
    expect(parsed.script).toBeTruthy();
    expect(parsed.script?.lang).toBe("ts");
    expect(parsed.script?.content).toContain("const x = 1");
  });

  it("reassembles SFC with updated script while preserving template/style", () => {
    const source = `<template><div>Hello</div></template>
<script>
const x = 1;
</script>
<style scoped>.a { color: red; }</style>
`;
    const parsed = parseSfc(source, "Comp.vue");
    const next = reassembleSfc(parsed, "\nconst x = 2;\n");
    expect(next).toContain("<template><div>Hello</div></template>");
    expect(next).toContain("<style scoped>.a { color: red; }</style>");
    expect(next).toContain("const x = 2;");
    expect(next).not.toContain("const x = 1;");
  });
});

