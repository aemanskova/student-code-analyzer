import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { VUE_METRICS, VueMetricProvider } from "./vue-metric.provider";

describe("VueMetricProvider", () => {
  let tempDir: string;

  const createProvider = () =>
    new VueMetricProvider({
      get: jest.fn((_key: string, fallback?: string) => fallback)
    } as never);

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vue-metrics-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("supports only Vue glossary metric keys", () => {
    expect(VUE_METRICS).toEqual([
      "TS_ANY_VUE",
      "FORCE_UPDATE_VUE",
      "REF_OBJARR_VUE",
      "DOM_CALLS_VUE",
      "COG_COMPLEX_VUE",
      "SMELL_VFOR_NOKEY",
      "SMELL_VHTML",
      "SMELL_MUT_PROPS",
      "SMELL_PROPS_REACT_LOSS",
      "VMD_TOTAL_ISSUES",
      "VMD_NO_TS_LANG",
      "VMD_PLAIN_SCRIPT",
      "VMD_HTML_LINKS",
      "VMD_NO_INLINE_STYLES",
      "VMD_SHORT_VAR",
      "VMD_COMMENTS",
      "VMD_BIG_VIF",
      "VMD_BIG_VSHOW",
      "VMD_COMPL_COND",
      "VMD_CC",
      "VMD_COMP_SIDEFX",
      "VMD_DEEP_INDENT",
      "VMD_ELSE",
      "VMD_FN_SIZE",
      "VMD_IMG_ELEMS",
      "VMD_HUGE_FILES",
      "VMD_IF_NO_CURLY",
      "VMD_MAGIC_NUM",
      "VMD_NESTED_TERN",
      "VMD_NO_IMPORTANT",
      "VMD_NO_DOM",
      "VMD_NO_PROP_DESTR",
      "VMD_NO_SKIP_TESTS",
      "VMD_NO_VAR",
      "VMD_PARAM_COUNT",
      "VMD_PROPS_DRILL",
      "VMD_REPEAT_CSS",
      "VMD_SCRIPT_LEN",
      "VMD_TOO_MANY_PROPS",
      "VMD_VFOR_EXPR",
      "VMD_VFOR_IDX_KEY",
      "VMD_ZERO_LEN_CMP",
      "VUEX_LOC",
      "VUEX_FNS_USER",
      "VUEX_FNS_ALL",
      "VUEX_AVG_FN_SIZE",
      "VUEX_FILES",
      "VUEX_CC_AVG",
      "VUEX_CC_SUM",
      "VUEX_NEST_MAX",
      "VUEX_PARAMS_MAX",
      "VUEX_HAL_VOL",
      "VUEX_HAL_DIFF",
      "VUEX_HAL_EFF",
      "VUEX_SIM_INT",
      "VUEX_MAINT",
      "VUEX_TS_ANY",
      "VUEX_FORCE_UPDATE",
      "VUEX_REF_OBJARR",
      "VUEX_DOM_CALLS",
      "VUEX_COG_COMPLEX"
    ]);
  });

  it("computes Vue script heuristics and Vuex-only metrics", async () => {
    await fs.writeFile(
      path.join(tempDir, "App.vue"),
      [
        "<template><div /></template>",
        '<script setup lang="ts">',
        "import { ref } from 'vue';",
        "const value: any = ref({ name: 'Ada' });",
        "function render(flag: boolean) {",
        "  if (flag) {",
        "    document.querySelector('#app');",
        "  }",
        "}",
        "render(Boolean(value));",
        "</script>"
      ].join("\n")
    );
    await fs.mkdir(path.join(tempDir, "src", "store"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src", "store", "index.ts"),
      [
        "import { ref } from 'vue';",
        "export const state: any = ref([]);",
        "export function mutate(flag: boolean) {",
        "  if (flag) {",
        "    document.getElementById('root');",
        "  }",
        "  return state;",
        "}"
      ].join("\n")
    );

    const result = await createProvider().computeSelected(
      { absolutePath: tempDir, relativePath: "." },
      [
        "TS_ANY_VUE",
        "REF_OBJARR_VUE",
        "DOM_CALLS_VUE",
        "FORCE_UPDATE_VUE",
        "VUEX_FILES",
        "VUEX_FNS_USER",
        "VUEX_TS_ANY",
        "VUEX_REF_OBJARR",
        "VUEX_DOM_CALLS"
      ]
    );

    expect(result.TS_ANY_VUE).toBe(2);
    expect(result.REF_OBJARR_VUE).toBe(2);
    expect(result.DOM_CALLS_VUE).toBe(2);
    expect(result.FORCE_UPDATE_VUE).toBe(0);
    expect(result.VUEX_FILES).toBe(1);
    expect(result.VUEX_FNS_USER).toBe(1);
    expect(result.VUEX_TS_ANY).toBe(1);
    expect(result.VUEX_REF_OBJARR).toBe(1);
    expect(result.VUEX_DOM_CALLS).toBe(1);
  });

  it("computes Vue ESLint smell metrics with the shared generated config", async () => {
    await fs.writeFile(
      path.join(tempDir, "Unsafe.vue"),
      [
        "<template>",
        "  <ul>",
        '    <li v-for="item in items" v-html="item"></li>',
        "  </ul>",
        "</template>",
        "<script setup>",
        "const items = ['<b>Ada</b>'];",
        "</script>"
      ].join("\n")
    );

    const result = await createProvider().computeSelected(
      { absolutePath: tempDir, relativePath: "." },
      ["SMELL_VFOR_NOKEY", "SMELL_VHTML"]
    );

    expect(result.SMELL_VFOR_NOKEY).toBeGreaterThanOrEqual(1);
    expect(result.SMELL_VHTML).toBe(1);
  });

  it("computes vue-mess-detector metrics when package.json is not exported", async () => {
    await fs.writeFile(
      path.join(tempDir, "PlainScript.vue"),
      [
        "<template>",
        '  <img src="/logo.png">',
        "</template>",
        "<script>",
        "export default {",
        "  data() {",
        "    return { count: 0 }",
        "  }",
        "}",
        "</script>"
      ].join("\n")
    );

    const result = await createProvider().computeSelected(
      { absolutePath: tempDir, relativePath: "." },
      ["VMD_TOTAL_ISSUES", "VMD_NO_TS_LANG", "VMD_PLAIN_SCRIPT"]
    );

    expect(result.VMD_TOTAL_ISSUES).toBeGreaterThan(0);
    expect(result.VMD_NO_TS_LANG).toBeGreaterThan(0);
    expect(result.VMD_PLAIN_SCRIPT).toBeGreaterThan(0);
  });
});
