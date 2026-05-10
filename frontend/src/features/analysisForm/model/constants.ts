import type { Direction } from "@entities/analysis/api"
import { ANALYSIS_DIRECTION_OPTIONS } from "@entities/analysis/model/direction"

export const DIRECTION_OPTIONS: Array<{ value: Direction; label: string }> =
  ANALYSIS_DIRECTION_OPTIONS

const HTML_CSS_METRICS = [
  "html_files",
  "css_files",
  "html_bytes_total",
  "css_bytes_total",
  "image_files_total",
  "image_bytes_total",
  "avg_image_size_bytes",
  "font_files_total",
  "font_bytes_total",
  "avg_font_size_bytes",
  "uses_avif",
  "uses_webp",
  "dom_nodes_avg",
  "max_dom_depth_max",
  "semantic_ratio_avg",
  "semantic_elements_total",
  "nonsemantic_containers_total",
  "semantic_element_usage_ratio_overall",
  "heading_order_violations_total",
  "img_missing_alt_total",
  "img_total",
  "img_missing_alt_ratio",
  "form_controls_missing_label_total",
  "form_controls_total",
  "form_controls_missing_label_ratio",
  "duplicate_ids_total",
  "duplicate_id_values_total",
  "vnu_files_checked",
  "vnu_errors_total",
  "vnu_warnings_total",
  "vnu_unparsed_files",
  "rules_total",
  "selectors_total",
  "avg_declarations_per_rule_avg",
  "max_declarations_per_rule_max",
  "import_count_total",
  "avg_specificity_avg",
  "max_specificity_max",
  "specificity_variance_overall",
  "complex_selectors_ratio_avg",
  "total_selector_complexity_total",
  "avg_selector_complexity_overall",
  "max_selector_complexity_max",
  "unique_css_properties_work",
  "unique_css_properties_avg",
  "dup_decl_ratio_avg",
  "axe_violations_total",
  "axe_critical",
  "axe_serious",
  "axe_moderate",
  "axe_minor"
]

const JS_METRICS = [
  "lines_of_code",
  "functions_count_user",
  "functions_count_all",
  "average_function_size",
  "files_count",
  "cyclomatic_complexity_avg",
  "cyclomatic_complexity_sum",
  "maximum_nesting_depth",
  "max_parameters_per_function",
  "halstead_volume",
  "halstead_difficulty",
  "halstead_effort",
  "cognitive_complexity",
  "eslint_errors_count",
  "eslint_warnings_count",
  "internal_similarity",
  "maintainability",
  "complex_methods_count",
  "long_parameter_list_count",
  "dead_code_count",
  "long_methods_count",
  "unused_parameters_count",
  "unused_variables_count",
  "undeclared_variables_count",
  "long_message_chains_count",
  "long_scope_chaining_count",
  "inner_html_usage_count",
  "switch_without_default_count"
]

const TYPESCRIPT_METRICS = [
  "LOC",
  "MLOC avg",
  "MLOC max",
  "ADI",
  "AESI (typed throws ratio)",
  "AMGI",
  "AMNOI (перегрузки функций)",
  "APLCI",
  "APXI",
  "ASYNC_USAGE total (async function + await + then/catch/finally + new Promise)",
  "ASYNC_USAGE per LOC",
  "CHAIN_LENGTH max (длинные цепочки вызовов/обращений)",
  "Discriminated Unions share (Tagged Union)",
  "explicit any count",
  "explicit unknown count",
  "Files count analyzed",
  "Generic Precision score",
  "implicit any count (diagnostics)",
  "strict enabled",
  "type assertions count (as/<T>)",
  "Typed Error Handling score"
]

const VUE_METRICS = [
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
]

export const ESLINT_METRICS = ["eslint_errors_count", "eslint_warnings_count"] as const
export const ESLINT_METRIC_SET = new Set<string>(ESLINT_METRICS)

export const DEFAULT_JS_ESLINT_CONFIG = `export default [
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.git/**"
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
      "no-redeclare": "error",
      "no-unreachable": "error",
      "no-inner-declarations": "warn"
    }
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs"
    }
  }
]`

export const METRICS_BY_DIRECTION: Record<Direction, string[]> = {
  html_css: HTML_CSS_METRICS,
  js: JS_METRICS,
  typescript: [...JS_METRICS, ...TYPESCRIPT_METRICS],
  vue: VUE_METRICS
}
