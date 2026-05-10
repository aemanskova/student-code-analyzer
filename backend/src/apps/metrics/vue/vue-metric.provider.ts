import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { builtinModules, createRequire } from "node:module";
import { promisify } from "node:util";
import { parse } from "@babel/parser";
import { get as levenshteinDistance } from "fast-levenshtein";
import fg = require("fast-glob");
import { DirectionMetricProvider, MetricComputeContext, MetricValues } from "../metrics.types";

const escomplex = require("typhonjs-escomplex") as {
  analyzeModule: (code: string) => {
    aggregate?: {
      halstead?: {
        difficulty?: number;
        effort?: number;
        volume?: number;
      };
    };
  };
};

type AstNode = {
  type: string;
  loc?: { start?: { line?: number }; end?: { line?: number } };
  [key: string]: unknown;
};

type FileMetrics = {
  cyclomaticSum: number;
  directDomCallsCount: number;
  forceUpdateCount: number;
  functionsAll: number;
  functionsUser: number;
  halsteadDifficulty: number;
  halsteadEffort: number;
  halsteadVolume: number;
  internalSimilarity: number;
  locCode: number;
  maxNestingDepth: number;
  maxParams: number;
  refComplexObjectCount: number;
  tsAnyCount: number;
};

type Summary = {
  averageFunctionSize: number;
  cyclomaticAvg: number;
  cyclomaticSum: number;
  directDomCalls: number;
  files: number;
  forceUpdate: number;
  functionsAll: number;
  functionsUser: number;
  halsteadDifficulty: number;
  halsteadEffort: number;
  halsteadVolume: number;
  internalSimilarity: number;
  locCode: number;
  maintainability: number;
  maxNestingDepth: number;
  maxParams: number;
  refComplex: number;
  tsAny: number;
};

type VueEslintSmells = {
  mutatingProps: number;
  propsReactivityLoss: number;
  vforNoKey: number;
  vHtml: number;
};

type VmdReport = {
  counts: Map<string, number>;
  total: number;
};

type SonarTaskResponse = {
  ceTaskId?: string;
  projectKey?: string;
  serverUrl?: string;
};

type SonarCeTaskResponse = {
  task?: {
    status?: string;
  };
};

export const VUE_METRICS = [
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
];

const SCRIPT_METRIC_KEYS = new Set([
  "TS_ANY_VUE",
  "FORCE_UPDATE_VUE",
  "REF_OBJARR_VUE",
  "DOM_CALLS_VUE",
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
  "VUEX_DOM_CALLS"
]);

const VMD_RULE_COLUMNS: Record<string, string[]> = {
  VMD_TOTAL_ISSUES: ["__TOTAL__"],
  VMD_NO_TS_LANG: ["rrd ~ no ts lang", "rrd/no-ts-lang", "No Ts Lang"],
  VMD_PLAIN_SCRIPT: ["rrd ~ Plain <script> blocks", "rrd/plain-script", "Plain Script"],
  VMD_HTML_LINKS: ["rrd ~ html link", "rrd/html-links", "HTML links", "HTML Links"],
  VMD_NO_INLINE_STYLES: ["rrd ~ no Inline Styles", "rrd/no-inline-styles", "No Inline Styles"],
  VMD_SHORT_VAR: ["rrd ~ short variable names", "rrd/short-variable-name", "Short Variable Name"],
  VMD_COMMENTS: ["rrd ~ amountOfComments", "rrd/amount-of-comments", "Amount of Comments"],
  VMD_BIG_VIF: ["rrd ~ bigVif", "rrd/big-v-if", "Big v-if"],
  VMD_BIG_VSHOW: ["rrd ~ bigVshow", "rrd/big-v-show", "Big v-show"],
  VMD_COMPL_COND: [
    "rrd ~ complicatedConditions",
    "rrd/complicated-conditions",
    "Complicated Conditions"
  ],
  VMD_CC: ["rrd ~ cyclomaticComplexity", "rrd/cyclomatic-complexity", "Cyclomatic Complexity"],
  VMD_COMP_SIDEFX: [
    "rrd ~ computedSideEffects",
    "rrd/computed-side-effects",
    "Computed Side Effects"
  ],
  VMD_DEEP_INDENT: ["rrd ~ deepIndentation", "rrd/deep-indentation", "Deep Indentation"],
  VMD_ELSE: ["rrd ~ elseCondition", "rrd/else-condition", "Else Condition"],
  VMD_FN_SIZE: ["rrd ~ functionSize", "rrd/function-size", "Function Size"],
  VMD_IMG_ELEMS: ["rrd ~ htmlImageElements", "rrd/html-image-elements", "HTML Image Elements"],
  VMD_HUGE_FILES: ["rrd ~ hugeFiles", "rrd/huge-files", "Huge Files"],
  VMD_IF_NO_CURLY: [
    "rrd ~ ifWithoutCurlyBraces",
    "rrd/if-without-curly-braces",
    "If Without Curly Braces"
  ],
  VMD_MAGIC_NUM: ["rrd ~ magicNumbers", "rrd/magic-numbers", "Magic Numbers"],
  VMD_NESTED_TERN: ["rrd ~ nestedTernary", "rrd/nested-ternary", "Nested Ternary"],
  VMD_NO_IMPORTANT: ["rrd ~ noImportant", "rrd/no-important", "No !Important", "No Important"],
  VMD_NO_DOM: ["rrd ~ noDirectDomAccess", "rrd/no-direct-dom-access", "No Direct Dom Access"],
  VMD_NO_PROP_DESTR: ["rrd ~ noPropDestructure", "rrd/no-prop-destructing", "No Prop Destructing"],
  VMD_NO_SKIP_TESTS: ["rrd ~ noSkippedTests", "rrd/no-skipped-tests", "No Skipped Tests"],
  VMD_NO_VAR: ["rrd ~ noVarDeclaration", "rrd/no-var-declaration", "No Var Declaration"],
  VMD_PARAM_COUNT: ["rrd ~ parameterCount", "rrd/parameter-count", "Parameter Count"],
  VMD_PROPS_DRILL: ["rrd ~ propsDrilling", "rrd/props-drilling", "Props Drilling"],
  VMD_REPEAT_CSS: ["rrd ~ repeatedCss", "rrd/repeated-css", "Repeated CSS"],
  VMD_SCRIPT_LEN: ["rrd ~ scriptLength", "rrd/script-length", "Script Length"],
  VMD_TOO_MANY_PROPS: ["rrd ~ tooManyProps", "rrd/too-many-props", "Too Many Props"],
  VMD_VFOR_EXPR: ["rrd ~ vForExpression", "rrd/vfor-expression", "VFor Expression"],
  VMD_VFOR_IDX_KEY: ["rrd ~ vForWithIndexKey", "rrd/vfor-with-index-key", "VFor with Index Key"],
  VMD_ZERO_LEN_CMP: [
    "rrd ~ zeroLengthComparison",
    "rrd/zero-length-comparison",
    "Zero Length Comparison"
  ]
};

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue"]);
const FUNCTION_NODES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "ClassPrivateMethod"
]);
const CYCLOMATIC_INCREMENTS = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "CatchClause"
]);
const NESTING_INCREMENTS = new Set([
  "IfStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "SwitchStatement",
  "TryStatement",
  "CatchClause",
  "WithStatement"
]);
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.git/**",
  "**/.next/**",
  "**/out/**",
  "**/.analysis-eslint/**",
  "**/.config/**"
];
const DOM_METHODS = new Set([
  "querySelector",
  "querySelectorAll",
  "getElementById",
  "getElementsByClassName",
  "getElementsByTagName",
  "getElementsByName"
]);
const EMPTY_SUMMARY: Summary = {
  averageFunctionSize: 0,
  cyclomaticAvg: 0,
  cyclomaticSum: 0,
  directDomCalls: 0,
  files: 0,
  forceUpdate: 0,
  functionsAll: 0,
  functionsUser: 0,
  halsteadDifficulty: 0,
  halsteadEffort: 0,
  halsteadVolume: 0,
  internalSimilarity: 0,
  locCode: 0,
  maintainability: 0,
  maxNestingDepth: 0,
  maxParams: 0,
  refComplex: 0,
  tsAny: 0
};

@Injectable()
export class VueMetricProvider implements DirectionMetricProvider {
  readonly direction = "vue";
  readonly supportedMetrics = VUE_METRICS;
  private readonly logger = new Logger(VueMetricProvider.name);
  private readonly execFileAsync = promisify(execFile);
  private readonly sonarAnalysisCache = new Map<string, Promise<string | null>>();

  constructor(private readonly config: ConfigService) {}

  async computeSelected(context: MetricComputeContext, metrics: string[]): Promise<MetricValues> {
    const needsScriptMetrics = metrics.some((metric) => SCRIPT_METRIC_KEYS.has(metric));
    const scriptSummaryPromise = needsScriptMetrics
      ? this.analyzeTargets([context.absolutePath])
      : Promise.resolve(EMPTY_SUMMARY);
    const vuexSummaryPromise = metrics.some((metric) => metric.startsWith("VUEX_"))
      ? this.analyzeVuex(context.absolutePath)
      : Promise.resolve(EMPTY_SUMMARY);
    const eslintPromise = metrics.some((metric) => metric.startsWith("SMELL_"))
      ? this.runVueEslintSmells(context.absolutePath)
      : Promise.resolve({ mutatingProps: 0, propsReactivityLoss: 0, vforNoKey: 0, vHtml: 0 });
    const vmdPromise = metrics.some((metric) => metric.startsWith("VMD_"))
      ? this.runVueMessDetector(context.absolutePath)
      : Promise.resolve({ counts: new Map<string, number>(), total: 0 });
    const cognitivePromise = metrics.includes("COG_COMPLEX_VUE")
      ? this.fetchCognitiveComplexity(context)
      : Promise.resolve(0);
    const vuexCognitivePromise = metrics.includes("VUEX_COG_COMPLEX")
      ? this.fetchVuexCognitiveComplexity(context)
      : Promise.resolve(0);

    const [scriptSummary, vuexSummary, eslintSmells, vmd, cognitive, vuexCognitive] =
      await Promise.all([
        scriptSummaryPromise,
        vuexSummaryPromise,
        eslintPromise,
        vmdPromise,
        cognitivePromise,
        vuexCognitivePromise
      ]);

    const summary: Record<string, number> = {
      TS_ANY_VUE: scriptSummary.tsAny,
      FORCE_UPDATE_VUE: scriptSummary.forceUpdate,
      REF_OBJARR_VUE: scriptSummary.refComplex,
      DOM_CALLS_VUE: scriptSummary.directDomCalls,
      COG_COMPLEX_VUE: cognitive,
      SMELL_VFOR_NOKEY: eslintSmells.vforNoKey,
      SMELL_VHTML: eslintSmells.vHtml,
      SMELL_MUT_PROPS: eslintSmells.mutatingProps,
      SMELL_PROPS_REACT_LOSS: eslintSmells.propsReactivityLoss,
      VUEX_LOC: vuexSummary.locCode,
      VUEX_FNS_USER: vuexSummary.functionsUser,
      VUEX_FNS_ALL: vuexSummary.functionsAll,
      VUEX_AVG_FN_SIZE: vuexSummary.averageFunctionSize,
      VUEX_FILES: vuexSummary.files,
      VUEX_CC_AVG: vuexSummary.cyclomaticAvg,
      VUEX_CC_SUM: vuexSummary.cyclomaticSum,
      VUEX_NEST_MAX: vuexSummary.maxNestingDepth,
      VUEX_PARAMS_MAX: vuexSummary.maxParams,
      VUEX_HAL_VOL: vuexSummary.halsteadVolume,
      VUEX_HAL_DIFF: vuexSummary.halsteadDifficulty,
      VUEX_HAL_EFF: vuexSummary.halsteadEffort,
      VUEX_SIM_INT: vuexSummary.internalSimilarity,
      VUEX_MAINT: vuexSummary.maintainability,
      VUEX_TS_ANY: vuexSummary.tsAny,
      VUEX_FORCE_UPDATE: vuexSummary.forceUpdate,
      VUEX_REF_OBJARR: vuexSummary.refComplex,
      VUEX_DOM_CALLS: vuexSummary.directDomCalls,
      VUEX_COG_COMPLEX: vuexCognitive
    };
    for (const [metric, aliases] of Object.entries(VMD_RULE_COLUMNS)) {
      summary[metric] = this.pickVmdCount(vmd, aliases);
    }

    const values: MetricValues = {};
    for (const metric of metrics) {
      values[metric] = summary[metric] ?? null;
    }
    return values;
  }

  private async analyzeTargets(targets: string[]): Promise<Summary> {
    const files = await this.listFilesFromTargets(targets);
    const rows: FileMetrics[] = [];
    for (const filePath of files) {
      const raw = await fs.readFile(filePath, "utf8").catch(() => null);
      if (raw === null) continue;
      const codeForAnalysis = this.isVueFile(filePath) ? this.extractVueScript(raw) : raw;
      if (!codeForAnalysis.trim()) {
        rows.push(this.emptyFileMetrics(raw));
        continue;
      }
      try {
        rows.push(this.analyzeFile(raw, codeForAnalysis, filePath));
      } catch {
        continue;
      }
    }
    return this.buildSummary(rows);
  }

  private async listFilesFromTargets(targets: string[]): Promise<string[]> {
    const out = new Set<string>();
    for (const target of targets) {
      const stat = await fs.stat(target).catch(() => null);
      if (stat?.isFile()) {
        if (SOURCE_EXTENSIONS.has(path.extname(target).toLowerCase()))
          out.add(path.resolve(target));
        continue;
      }
      if (stat?.isDirectory()) {
        const found = (await fg(["**/*"], {
          absolute: true,
          cwd: target,
          dot: true,
          ignore: IGNORE_PATTERNS,
          onlyFiles: true
        })) as string[];
        for (const filePath of found) {
          if (SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
            out.add(path.resolve(filePath));
          }
        }
      }
    }
    return [...out].sort((a, b) => a.localeCompare(b));
  }

  private analyzeFile(rawCode: string, codeForAnalysis: string, filePath: string): FileMetrics {
    const ast = this.parseCode(codeForAnalysis, filePath);
    const astRoot = this.getProgramRoot(ast);
    const counters = {
      cyclomaticSum: 0,
      functionsAll: 0,
      functionsUser: 0,
      maxNestingDepth: 0,
      maxParams: 0
    };

    const walkFunctions = (node: AstNode, parent: AstNode | null = null) => {
      if (FUNCTION_NODES.has(node.type)) {
        counters.functionsAll += 1;
        if (this.isUserFunctionNode(node, parent)) {
          counters.functionsUser += 1;
          const metrics = this.analyzeFunctionBody(node);
          counters.cyclomaticSum += metrics.cyclomatic;
          counters.maxParams = Math.max(counters.maxParams, metrics.params);
          counters.maxNestingDepth = Math.max(counters.maxNestingDepth, metrics.maxNestingDepth);
        }
      }
      for (const child of this.getChildren(node)) {
        walkFunctions(child, node);
      }
    };

    walkFunctions(astRoot);
    const halstead = this.analyzeHalsteadSafely(codeForAnalysis);
    return {
      ...counters,
      ...halstead,
      directDomCallsCount: this.countDirectDomCalls(astRoot),
      forceUpdateCount: this.countForceUpdate(astRoot),
      internalSimilarity: this.calculateInternalSimilarity(rawCode),
      locCode: this.countCodeLines(codeForAnalysis),
      refComplexObjectCount: this.countRefComplexObject(astRoot),
      tsAnyCount: this.countTsAny(astRoot)
    };
  }

  private emptyFileMetrics(rawCode: string): FileMetrics {
    return {
      cyclomaticSum: 0,
      directDomCallsCount: 0,
      forceUpdateCount: 0,
      functionsAll: 0,
      functionsUser: 0,
      halsteadDifficulty: 0,
      halsteadEffort: 0,
      halsteadVolume: 0,
      internalSimilarity: this.calculateInternalSimilarity(rawCode),
      locCode: 0,
      maxNestingDepth: 0,
      maxParams: 0,
      refComplexObjectCount: 0,
      tsAnyCount: 0
    };
  }

  private parseCode(code: string, filePath: string): AstNode {
    return parse(code, {
      allowReturnOutsideFunction: true,
      errorRecovery: true,
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        "decorators-legacy",
        "dynamicImport",
        "importMeta",
        "topLevelAwait",
        "optionalChaining",
        "nullishCoalescingOperator"
      ],
      sourceFilename: filePath,
      sourceType: "unambiguous"
    }) as unknown as AstNode;
  }

  private getProgramRoot(ast: AstNode): AstNode {
    return this.isNode(ast.program) ? ast.program : ast;
  }

  private isNode(value: unknown): value is AstNode {
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && "type" in value);
  }

  private getChildren(node: AstNode): AstNode[] {
    const children: AstNode[] = [];
    for (const [key, value] of Object.entries(node)) {
      if (
        [
          "comments",
          "errors",
          "extra",
          "innerComments",
          "leadingComments",
          "loc",
          "parent",
          "range",
          "tokens",
          "trailingComments"
        ].includes(key)
      ) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.isNode(item)) children.push(item);
        }
      } else if (this.isNode(value)) {
        children.push(value);
      }
    }
    return children;
  }

  private analyzeFunctionBody(fnNode: AstNode) {
    const params = Array.isArray(fnNode.params) ? fnNode.params.length : 0;
    let cyclomatic = 1;
    let depth = 0;
    let maxNestingDepth = 0;

    const walk = (node: AstNode, parent: AstNode | null = null) => {
      if (node.type === "IfStatement") {
        const isElseIf = parent?.type === "IfStatement" && parent.alternate === node;
        if (!isElseIf) cyclomatic += 1;
      }
      if (CYCLOMATIC_INCREMENTS.has(node.type)) cyclomatic += 1;
      if (node.type === "SwitchCase" && node.test != null) cyclomatic += 1;
      if (node.type === "ConditionalExpression") cyclomatic += 1;

      const isElseIfForDepth =
        node.type === "IfStatement" && parent?.type === "IfStatement" && parent.alternate === node;
      const incrementsDepth =
        NESTING_INCREMENTS.has(node.type) && !(node.type === "IfStatement" && isElseIfForDepth);
      if (incrementsDepth) {
        depth += 1;
        maxNestingDepth = Math.max(maxNestingDepth, depth);
      }
      for (const child of this.getChildren(node)) {
        if (!FUNCTION_NODES.has(child.type)) walk(child, node);
      }
      if (incrementsDepth) depth -= 1;
    };

    if (this.isNode(fnNode.body)) walk(fnNode.body, fnNode);
    return { cyclomatic, maxNestingDepth, params };
  }

  private isUserFunctionNode(fnNode: AstNode, parent: AstNode | null): boolean {
    if (
      fnNode.type === "FunctionDeclaration" ||
      fnNode.type === "ObjectMethod" ||
      fnNode.type === "ClassMethod" ||
      fnNode.type === "ClassPrivateMethod"
    ) {
      return true;
    }
    if (parent?.type === "VariableDeclarator" && this.isIdentifier(parent.id)) return true;
    if (parent?.type === "AssignmentExpression") {
      const left = parent.left;
      if (this.isIdentifier(left) || this.isMemberExpression(left)) return true;
    }
    if (parent?.type === "ObjectProperty") return true;
    if (parent?.type === "ExportDefaultDeclaration") return true;
    return fnNode.type === "FunctionExpression" && this.isIdentifier(fnNode.id);
  }

  private analyzeHalsteadSafely(code: string) {
    try {
      const report = escomplex.analyzeModule(code);
      const halstead = report.aggregate?.halstead;
      return {
        halsteadDifficulty: this.round(halstead?.difficulty ?? 0),
        halsteadEffort: this.round(halstead?.effort ?? 0),
        halsteadVolume: this.round(halstead?.volume ?? 0)
      };
    } catch {
      return { halsteadDifficulty: 0, halsteadEffort: 0, halsteadVolume: 0 };
    }
  }

  private countTsAny(astRoot: AstNode): number {
    let count = 0;
    const walk = (node: AstNode) => {
      if (node.type === "TSAnyKeyword") count += 1;
      for (const child of this.getChildren(node)) walk(child);
    };
    walk(astRoot);
    return count;
  }

  private countForceUpdate(astRoot: AstNode): number {
    let count = 0;
    const walk = (node: AstNode) => {
      if (node.type === "CallExpression") {
        const callee = node.callee;
        if (
          this.isMemberExpression(callee) &&
          !callee.computed &&
          this.isIdentifier(callee.property) &&
          callee.property.name === "$forceUpdate"
        ) {
          count += 1;
        }
      }
      for (const child of this.getChildren(node)) walk(child);
    };
    walk(astRoot);
    return count;
  }

  private countRefComplexObject(astRoot: AstNode): number {
    let count = 0;
    const walk = (node: AstNode) => {
      if (
        node.type === "CallExpression" &&
        this.isIdentifier(node.callee) &&
        node.callee.name === "ref" &&
        Array.isArray(node.arguments) &&
        node.arguments.length === 1 &&
        this.isNode(node.arguments[0]) &&
        (node.arguments[0].type === "ObjectExpression" ||
          node.arguments[0].type === "ArrayExpression")
      ) {
        count += 1;
      }
      for (const child of this.getChildren(node)) walk(child);
    };
    walk(astRoot);
    return count;
  }

  private countDirectDomCalls(astRoot: AstNode): number {
    let count = 0;
    const walk = (node: AstNode) => {
      if (node.type === "CallExpression") {
        const callee = node.callee;
        if (
          this.isMemberExpression(callee) &&
          !callee.computed &&
          this.isIdentifier(callee.object) &&
          callee.object.name === "document" &&
          this.isIdentifier(callee.property) &&
          DOM_METHODS.has(callee.property.name)
        ) {
          count += 1;
        }
      }
      for (const child of this.getChildren(node)) walk(child);
    };
    walk(astRoot);
    return count;
  }

  private buildSummary(rows: FileMetrics[]): Summary {
    const totals = rows.reduce(
      (acc, row) => {
        acc.cyclomaticSum += row.cyclomaticSum;
        acc.directDomCalls += row.directDomCallsCount;
        acc.forceUpdate += row.forceUpdateCount;
        acc.functionsAll += row.functionsAll;
        acc.functionsUser += row.functionsUser;
        acc.halsteadDifficultySum += row.halsteadDifficulty;
        acc.halsteadEffortSum += row.halsteadEffort;
        acc.halsteadVolumeSum += row.halsteadVolume;
        acc.internalSimilaritySum += row.internalSimilarity;
        acc.locCode += row.locCode;
        acc.maxNestingDepth = Math.max(acc.maxNestingDepth, row.maxNestingDepth);
        acc.maxParams = Math.max(acc.maxParams, row.maxParams);
        acc.refComplex += row.refComplexObjectCount;
        acc.tsAny += row.tsAnyCount;
        return acc;
      },
      {
        cyclomaticSum: 0,
        directDomCalls: 0,
        forceUpdate: 0,
        functionsAll: 0,
        functionsUser: 0,
        halsteadDifficultySum: 0,
        halsteadEffortSum: 0,
        halsteadVolumeSum: 0,
        internalSimilaritySum: 0,
        locCode: 0,
        maxNestingDepth: 0,
        maxParams: 0,
        refComplex: 0,
        tsAny: 0
      }
    );
    const files = rows.length;
    const cyclomaticAvg =
      totals.functionsUser > 0 ? totals.cyclomaticSum / totals.functionsUser : 0;
    const averageFunctionSize =
      totals.functionsUser > 0 ? totals.locCode / totals.functionsUser : 0;
    const halsteadDifficulty = files > 0 ? totals.halsteadDifficultySum / files : 0;
    const internalSimilarity = files > 0 ? totals.internalSimilaritySum / files : 0;
    const maintainability = this.calculateMaintainability(
      totals.locCode || 1,
      totals.cyclomaticSum || 0,
      totals.halsteadVolumeSum || 1
    );

    return {
      averageFunctionSize: this.round(averageFunctionSize),
      cyclomaticAvg: this.round(cyclomaticAvg),
      cyclomaticSum: totals.cyclomaticSum,
      directDomCalls: totals.directDomCalls,
      files,
      forceUpdate: totals.forceUpdate,
      functionsAll: totals.functionsAll,
      functionsUser: totals.functionsUser,
      halsteadDifficulty: this.round(halsteadDifficulty),
      halsteadEffort: this.round(totals.halsteadEffortSum),
      halsteadVolume: this.round(totals.halsteadVolumeSum),
      internalSimilarity: this.round(internalSimilarity),
      locCode: totals.locCode,
      maintainability: this.round(maintainability),
      maxNestingDepth: totals.maxNestingDepth,
      maxParams: totals.maxParams,
      refComplex: totals.refComplex,
      tsAny: totals.tsAny
    };
  }

  private async runVueEslintSmells(projectPath: string): Promise<VueEslintSmells> {
    const eslintBin = this.resolvePackageBin("eslint", ["bin", "eslint.js"]);
    if (!eslintBin) return { mutatingProps: 0, propsReactivityLoss: 0, vforNoKey: 0, vHtml: 0 };

    const configPath = await this.createVueEslintConfig(projectPath).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Vue ESLint skipped: ${message}`);
      return null;
    });
    if (!configPath) return { mutatingProps: 0, propsReactivityLoss: 0, vforNoKey: 0, vHtml: 0 };

    const args = [
      ".",
      "--config",
      configPath,
      "--no-config-lookup",
      "--ext",
      ".vue,.js,.jsx,.ts,.tsx",
      "--format",
      "json",
      "--ignore-pattern",
      "node_modules/**",
      "--ignore-pattern",
      "dist/**",
      "--ignore-pattern",
      "build/**",
      "--ignore-pattern",
      "coverage/**",
      "--ignore-pattern",
      ".git/**",
      "--ignore-pattern",
      ".next/**",
      "--ignore-pattern",
      "out/**",
      "--ignore-pattern",
      ".analysis-eslint/**"
    ];

    try {
      const { stdout } = await this.execFileAsync(eslintBin, args, {
        cwd: projectPath,
        maxBuffer: 40 * 1024 * 1024,
        windowsHide: true
      });
      return this.parseVueEslintReport(stdout);
    } catch (error) {
      const execError = error as { stdout?: string; message?: string; stderr?: string };
      if (execError.stdout) {
        return this.parseVueEslintReport(execError.stdout);
      }
      const details = [execError.message, execError.stderr].filter(Boolean).join("\n").trim();
      this.logger.warn(`Vue ESLint did not produce JSON report for ${projectPath}: ${details}`);
      return { mutatingProps: 0, propsReactivityLoss: 0, vforNoKey: 0, vHtml: 0 };
    } finally {
      await fs
        .rm(path.dirname(configPath), { force: true, recursive: true })
        .catch(() => undefined);
    }
  }

  private async createVueEslintConfig(projectPath: string): Promise<string> {
    const configDir = path.join(projectPath, ".analysis-eslint");
    await fs.mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, "vue.config.cjs");
    const configText = [
      "const vueParser = require('vue-eslint-parser');",
      "const tsParser = require('@typescript-eslint/parser');",
      "const vue = require('eslint-plugin-vue');",
      "module.exports = [",
      "  {",
      "    files: ['**/*.{vue,js,jsx,ts,tsx}'],",
      "    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**'],",
      "    languageOptions: {",
      "      parser: vueParser,",
      "      parserOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module', extraFileExtensions: ['.vue'] },",
      "      globals: { console: 'readonly', window: 'readonly', document: 'readonly', process: 'readonly' }",
      "    },",
      "    plugins: { vue },",
      "    rules: {",
      "      'vue/require-v-for-key': 'error',",
      "      'vue/valid-v-for': 'error',",
      "      'vue/no-v-html': 'error',",
      "      'vue/no-mutating-props': 'error',",
      "      'vue/no-setup-props-reactivity-loss': 'error'",
      "    }",
      "  }",
      "];",
      ""
    ].join("\n");
    await fs.writeFile(configPath, configText, "utf8");
    await this.linkBackendNodeModules(configDir);
    this.ensurePackageResolvable(configPath, "vue-eslint-parser");
    this.ensurePackageResolvable(configPath, "@typescript-eslint/parser");
    this.ensurePackageResolvable(configPath, "eslint-plugin-vue");
    return configPath;
  }

  private parseVueEslintReport(output: string): VueEslintSmells {
    const out = { mutatingProps: 0, propsReactivityLoss: 0, vforNoKey: 0, vHtml: 0 };
    let report: Array<{ messages?: Array<{ ruleId?: string | null }> }>;
    try {
      report = JSON.parse(output || "[]") as Array<{
        messages?: Array<{ ruleId?: string | null }>;
      }>;
      if (!Array.isArray(report)) return out;
    } catch {
      return out;
    }
    for (const file of report) {
      for (const message of file.messages || []) {
        switch (message.ruleId) {
          case "vue/require-v-for-key":
          case "vue/valid-v-for":
            out.vforNoKey += 1;
            break;
          case "vue/no-v-html":
            out.vHtml += 1;
            break;
          case "vue/no-mutating-props":
            out.mutatingProps += 1;
            break;
          case "vue/no-setup-props-reactivity-loss":
            out.propsReactivityLoss += 1;
            break;
        }
      }
    }
    return out;
  }

  private async runVueMessDetector(projectPath: string): Promise<VmdReport> {
    const vmdBin = this.resolvePackageBin("vue-mess-detector", ["dist", "cliStart.js"]);
    if (!vmdBin) return { counts: new Map(), total: 0 };

    const args = ["analyze", projectPath, "--output=json", "--group=file"];
    const temporaryPackageJsonPath = await this.ensureVmdProjectPackage(projectPath);
    try {
      const { stdout } = await this.execFileAsync(vmdBin, args, {
        cwd: process.cwd(),
        env: { ...process.env, NO_COLOR: "1" },
        maxBuffer: 80 * 1024 * 1024,
        windowsHide: true
      });
      return this.parseVmdReport(stdout);
    } catch (error) {
      const execError = error as { stdout?: string; message?: string; stderr?: string };
      if (execError.stdout) return this.parseVmdReport(execError.stdout);
      const details = [execError.message, execError.stderr].filter(Boolean).join("\n").trim();
      this.logger.warn(`vue-mess-detector failed for ${projectPath}: ${details}`);
      return { counts: new Map(), total: 0 };
    } finally {
      if (temporaryPackageJsonPath) {
        await fs.rm(temporaryPackageJsonPath, { force: true }).catch(() => undefined);
      }
    }
  }

  private async ensureVmdProjectPackage(projectPath: string): Promise<string | null> {
    const existingRoot = await this.findPackageRoot(projectPath);
    if (existingRoot) {
      return null;
    }

    const packageJsonPath = path.join(projectPath, "package.json");
    await fs.writeFile(packageJsonPath, '{"private":true}\n', { flag: "wx" }).catch((error) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
    });
    return packageJsonPath;
  }

  private async findPackageRoot(startPath: string): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    while (true) {
      const packageJsonPath = path.join(currentPath, "package.json");
      const exists = await fs
        .stat(packageJsonPath)
        .then((stat) => stat.isFile())
        .catch(() => false);
      if (exists) {
        return currentPath;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        return null;
      }
      currentPath = parentPath;
    }
  }

  private parseVmdReport(output: string): VmdReport {
    try {
      const cleaned = String(output || "")
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
      const json = JSON.parse(cleaned) as { reportOutput?: Record<string, unknown> };
      const counts = new Map<string, number>();
      let total = 0;
      for (const arr of Object.values(json.reportOutput || {})) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          const id = String((item as { id?: unknown })?.id ?? "").trim();
          if (!id) continue;
          counts.set(id, (counts.get(id) || 0) + 1);
          total += 1;
        }
      }
      return { counts, total };
    } catch {
      return { counts: new Map(), total: 0 };
    }
  }

  private pickVmdCount(vmd: VmdReport, aliases: string[]): number {
    if (aliases[0] === "__TOTAL__") return vmd.total;
    for (const alias of aliases) {
      const value = vmd.counts.get(alias);
      if (typeof value === "number") return value;
    }
    return 0;
  }

  private async analyzeVuex(projectPath: string): Promise<Summary> {
    const roots = await this.findVuexRoots(projectPath);
    if (!roots.length) return EMPTY_SUMMARY;
    return this.analyzeTargets(roots);
  }

  private async findVuexRoots(projectPath: string): Promise<string[]> {
    const candidates = [
      path.join(projectPath, "store"),
      path.join(projectPath, "src", "store"),
      path.join(projectPath, "src", "stores")
    ];
    const roots: string[] = [];
    for (const candidate of candidates) {
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isDirectory()) roots.push(candidate);
    }
    if (!roots.length) {
      const matches = (await fg(["**/store/**", "**/stores/**"], {
        absolute: true,
        cwd: projectPath,
        deep: 4,
        dot: true,
        ignore: IGNORE_PATTERNS,
        onlyDirectories: true
      }).catch(() => [])) as string[];
      const unique = new Set<string>();
      for (const match of matches) {
        const rel = path.relative(projectPath, match);
        const first = rel.split(path.sep)[0];
        unique.add(path.join(projectPath, first));
      }
      roots.push(...unique);
    }
    return [...new Set(roots)].sort((a, b) => a.localeCompare(b));
  }

  private async fetchVuexCognitiveComplexity(context: MetricComputeContext): Promise<number> {
    const roots = await this.findVuexRoots(context.absolutePath);
    if (!roots.length) return 0;
    const values = await Promise.all(
      roots.map((root) =>
        this.fetchCognitiveComplexity({
          ...context,
          absolutePath: root,
          relativePath: path.join(
            context.relativePath || ".",
            path.relative(context.absolutePath, root)
          )
        })
      )
    );
    return values.reduce((sum, value) => sum + value, 0);
  }

  private async fetchCognitiveComplexity(context: MetricComputeContext): Promise<number> {
    const host = this.config.get<string>("SONAR_HOST", "http://localhost:9000");
    const token = this.config.get<string>("SONAR_TOKEN", "");
    const projectKey = await this.ensureRootSonarAnalysis(context, host, token);
    if (!projectKey) return 0;
    const componentKey = this.buildSonarComponentKey(projectKey, context);
    return (await this.fetchSonarMeasure(host, token, componentKey)) ?? 0;
  }

  private async ensureRootSonarAnalysis(
    context: MetricComputeContext,
    host: string,
    token: string
  ): Promise<string | null> {
    const rootPath = context.rootAbsolutePath || context.absolutePath;
    const projectKey = this.buildAnalysisProjectKey(context);
    const cacheKey = `${host}|${projectKey}|${rootPath}`;
    const cached = this.sonarAnalysisCache.get(cacheKey);
    if (cached) return cached;
    const promise = this.runRootSonarAnalysis(context, host, token, rootPath, projectKey);
    this.sonarAnalysisCache.set(cacheKey, promise);
    return promise;
  }

  private async runRootSonarAnalysis(
    context: MetricComputeContext,
    host: string,
    token: string,
    rootPath: string,
    projectKey: string
  ): Promise<string | null> {
    const scannerBin = this.config.get<string>("SONAR_SCANNER_BIN", "sonar-scanner");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sonar-vue-"));
    const reportPath = path.join(tempDir, "report-task.txt");
    try {
      const args = [
        `-Dsonar.host.url=${host}`,
        `-Dsonar.projectKey=${projectKey}`,
        `-Dsonar.projectName=${this.buildAnalysisProjectName(context)}`,
        `-Dsonar.projectBaseDir=${rootPath}`,
        "-Dsonar.sources=.",
        `-Dsonar.working.directory=${path.join(tempDir, ".scannerwork")}`,
        `-Dsonar.scanner.metadataFilePath=${reportPath}`,
        "-Dsonar.sourceEncoding=UTF-8",
        "-Dsonar.inclusions=**/*.vue,**/*.js,**/*.jsx,**/*.mjs,**/*.cjs,**/*.ts,**/*.tsx",
        "-Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/.git/**,**/.next/**,**/out/**",
        "-Dsonar.scm.disabled=true",
        "-Dsonar.cpd.exclusions=**/*",
        "-Dsonar.javascript.file.suffixes=.js,.jsx,.mjs,.cjs",
        "-Dsonar.typescript.file.suffixes=.ts,.tsx,.vue"
      ];
      if (token) args.push(`-Dsonar.token=${token}`);
      const { stderr } = await this.execFileAsync(scannerBin, args, {
        cwd: rootPath,
        maxBuffer: 50 * 1024 * 1024,
        windowsHide: true
      });
      if (stderr?.trim())
        this.logger.warn(`SonarQube scanner stderr for ${rootPath}: ${stderr.trim()}`);
      const task = await this.readSonarTaskReport(reportPath);
      if (!task?.ceTaskId) return null;
      return (await this.waitForSonarTask(host, token, task.ceTaskId)) ? projectKey : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SonarQube scanner failed for ${rootPath}: ${message}`);
      return null;
    } finally {
      await fs.rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
    }
  }

  private async readSonarTaskReport(reportPath: string): Promise<SonarTaskResponse | null> {
    const text = await fs.readFile(reportPath, "utf8").catch(() => "");
    if (!text.trim()) return null;
    const values = new Map<string, string>();
    for (const line of text.split(/\r?\n/)) {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) continue;
      values.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 1));
    }
    return {
      ceTaskId: values.get("ceTaskId"),
      projectKey: values.get("projectKey"),
      serverUrl: values.get("serverUrl")
    };
  }

  private async waitForSonarTask(host: string, token: string, taskId?: string): Promise<boolean> {
    if (!taskId) return false;
    const timeoutMs = Number(this.config.get<string>("SONAR_TASK_TIMEOUT_MS", "120000"));
    const pollMs = Math.max(500, Number(this.config.get<string>("SONAR_TASK_POLL_MS", "500")));
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const task = await this.fetchSonarTask(host, token, taskId);
      const status = task?.task?.status;
      if (status === "SUCCESS") return true;
      if (status === "FAILED" || status === "CANCELED") return false;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return false;
  }

  private async fetchSonarTask(
    host: string,
    token: string,
    taskId: string
  ): Promise<SonarCeTaskResponse | null> {
    try {
      const url = `${host.replace(/\/+$/, "")}/api/ce/task?id=${encodeURIComponent(taskId)}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) return null;
      return (await response.json()) as SonarCeTaskResponse;
    } catch {
      return null;
    }
  }

  private async fetchSonarMeasure(
    host: string,
    token: string,
    componentKey: string
  ): Promise<number | null> {
    try {
      const url =
        `${host.replace(/\/+$/, "")}/api/measures/component` +
        `?component=${encodeURIComponent(componentKey)}` +
        `&metricKeys=${encodeURIComponent("cognitive_complexity")}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) return null;
      const data = (await response.json()) as {
        component?: { measures?: Array<{ metric?: string; value?: string }> };
      };
      const measure = data.component?.measures?.find(
        (item) => item.metric === "cognitive_complexity"
      );
      return Number(measure?.value ?? 0);
    } catch {
      return null;
    }
  }

  private buildAnalysisProjectKey(context: MetricComputeContext): string {
    const rootPath = context.rootAbsolutePath || context.absolutePath;
    const source = context.runId || rootPath;
    const hash = createHash("sha256").update(source).digest("hex").slice(0, 24);
    return `sca-vue:${hash}`;
  }

  private buildAnalysisProjectName(context: MetricComputeContext): string {
    const segments = String(context.relativePath || "")
      .split(/[\\/]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((segment) => segment !== ".");
    return `Vue ${segments[0] || "analysis"}`.slice(0, 80);
  }

  private buildSonarComponentKey(projectKey: string, context: MetricComputeContext): string {
    const rootPath = context.rootAbsolutePath || context.absolutePath;
    const relRaw = path.relative(rootPath, context.absolutePath);
    if (!relRaw || relRaw === "." || relRaw.startsWith("..") || path.isAbsolute(relRaw)) {
      return projectKey;
    }
    return `${projectKey}:${relRaw.replace(/\\/g, "/")}`;
  }

  private extractVueScript(code: string): string {
    const match = code.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
    return match ? match[1] : "";
  }

  private isVueFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".vue";
  }

  private countCodeLines(code: string): number {
    let inBlockComment = false;
    let count = 0;
    for (const rawLine of code.split(/\r?\n/)) {
      let line = rawLine.trim();
      if (!line) continue;
      if (inBlockComment) {
        const end = line.indexOf("*/");
        if (end === -1) continue;
        line = line.slice(end + 2).trim();
        inBlockComment = false;
        if (!line) continue;
      }
      while (line.startsWith("/*")) {
        const end = line.indexOf("*/", 2);
        if (end === -1) {
          inBlockComment = true;
          line = "";
          break;
        }
        line = line.slice(end + 2).trim();
      }
      if (!line || line.startsWith("//")) continue;
      count += 1;
    }
    return count;
  }

  private calculateInternalSimilarity(code: string): number {
    const blocks = code
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<string[]>((acc, _line, index, lines) => {
        if (index <= lines.length - 3) acc.push(lines.slice(index, index + 3).join("\n"));
        return acc;
      }, []);
    let similaritySum = 0;
    let similarityCount = 0;
    for (let i = 0; i < blocks.length; i += 1) {
      for (let j = i + 1; j < blocks.length; j += 1) {
        const distance = levenshteinDistance(blocks[i], blocks[j]);
        const maxLength = Math.max(blocks[i].length, blocks[j].length);
        similaritySum += maxLength === 0 ? 100 : ((maxLength - distance) / maxLength) * 100;
        similarityCount += 1;
      }
    }
    return similarityCount > 0 ? similaritySum / similarityCount : 0;
  }

  private calculateMaintainability(
    loc: number,
    cyclomatic: number,
    halsteadVolume: number
  ): number {
    if (loc <= 0 || cyclomatic < 0 || halsteadVolume <= 0) return 100;
    return Math.max(
      0,
      ((171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomatic - 16.2 * Math.log(loc)) * 100) /
        171
    );
  }

  private resolvePackageBin(packageName: string, binPath: string[]): string | null {
    const requireFromProvider = createRequire(__filename);
    try {
      const packageJsonPath = requireFromProvider.resolve(`${packageName}/package.json`);
      return path.join(path.dirname(packageJsonPath), ...binPath);
    } catch {
      const lookupPaths = requireFromProvider.resolve.paths(packageName) || [];
      for (const lookupPath of lookupPaths) {
        const candidate = path.join(lookupPath, packageName, ...binPath);
        if (existsSync(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  }

  private async linkBackendNodeModules(projectPath: string): Promise<void> {
    const backendNodeModules = this.resolveBackendNodeModulesPath();
    if (!backendNodeModules) return;
    const target = path.join(projectPath, "node_modules");
    try {
      await fs.symlink(backendNodeModules, target, "dir");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
    }
  }

  private resolveBackendNodeModulesPath(): string | null {
    try {
      const packageJsonPath = createRequire(__filename).resolve("eslint/package.json");
      return path.dirname(path.dirname(packageJsonPath));
    } catch {
      return null;
    }
  }

  private ensurePackageResolvable(configPath: string, packageName: string): void {
    const requireFromConfig = createRequire(configPath);
    requireFromConfig.resolve(packageName);
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  private isIdentifier(value: unknown): value is AstNode & { name: string } {
    return this.isNode(value) && value.type === "Identifier" && typeof value.name === "string";
  }

  private isMemberExpression(value: unknown): value is AstNode & {
    computed?: boolean;
    object?: unknown;
    property?: unknown;
  } {
    return this.isNode(value) && value.type === "MemberExpression";
  }

  private isNodeBuiltin(packageName: string): boolean {
    return builtinModules.includes(packageName.replace(/^node:/, ""));
  }
}
