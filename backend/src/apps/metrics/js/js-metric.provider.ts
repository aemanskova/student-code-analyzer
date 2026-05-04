import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import fg = require("fast-glob");
import { get as levenshteinDistance } from "fast-levenshtein";
import { parse } from "@babel/parser";
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
  loc?: { start?: { line?: number; column?: number }; end?: { line?: number; column?: number } };
  [key: string]: unknown;
};

type ScopeEntry = {
  kind: "class" | "function" | "param" | "variable";
  name: string;
  node: AstNode | null;
  used: boolean;
};

type Scope = {
  declared: Map<string, ScopeEntry>;
  parent: Scope | null;
  type: "block" | "function" | "program";
};

type FileMetrics = {
  locCode: number;
  functionsAll: number;
  functionsUser: number;
  maxNestingDepth: number;
  maxParams: number;
  cyclomaticSum: number;
  halsteadVolume: number;
  halsteadDifficulty: number;
  halsteadEffort: number;
  internalSimilarity: number;
  complexMethodsCount: number;
  longParameterListCount: number;
  deadCodeCount: number;
  longMethodsCount: number;
  unusedParametersCount: number;
  unusedVariablesCount: number;
  undeclaredVariablesCount: number;
  longMessageChainsCount: number;
  longScopeChainingCount: number;
  innerHtmlUsageCount: number;
  switchWithoutDefaultCount: number;
};

const JS_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"]);
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.git/**",
  "**/.next/**",
  "**/out/**",
  "**/public/three.js",
  "**/public/js/three.js",
  "**/public/static/js/three.js",
  "**/public/three.module.js"
];

const FUNCTION_NODES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "ClassPrivateMethod"
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

const CYCLOMATIC_INCREMENTS = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "CatchClause"
]);

const KNOWN_GLOBALS = new Set([
  "AbortController",
  "AbortSignal",
  "Array",
  "Boolean",
  "Buffer",
  "Date",
  "Error",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Proxy",
  "Reflect",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "TextDecoder",
  "TextEncoder",
  "TypeError",
  "URL",
  "URLSearchParams",
  "WeakMap",
  "WeakSet",
  "__dirname",
  "__filename",
  "clearImmediate",
  "clearInterval",
  "clearTimeout",
  "console",
  "document",
  "exports",
  "fetch",
  "globalThis",
  "isFinite",
  "isNaN",
  "module",
  "parseFloat",
  "parseInt",
  "process",
  "require",
  "setImmediate",
  "setInterval",
  "setTimeout",
  "window"
]);

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
];

type SonarTaskResponse = {
  ceTaskId?: string;
  projectKey?: string;
  serverUrl?: string;
};

type SonarCeTaskResponse = {
  task?: {
    analysisId?: string;
    status?: string;
  };
};

@Injectable()
export class JsMetricProvider implements DirectionMetricProvider {
  readonly direction = "js";
  readonly supportedMetrics = JS_METRICS;
  private readonly logger = new Logger(JsMetricProvider.name);
  private readonly execFileAsync = promisify(execFile);
  private readonly sonarAnalysisCache = new Map<string, Promise<string | null>>();

  constructor(private readonly config: ConfigService) {}

  async computeSelected(context: MetricComputeContext, metrics: string[]): Promise<MetricValues> {
    const files = await this.listFiles(context.absolutePath);
    const eslintCountsPromise = metrics.some((metric) => metric.startsWith("eslint_"))
      ? this.runEslintIfEnabled(context.absolutePath)
      : Promise.resolve({ errors: 0, warnings: 0 });
    const cognitiveComplexityPromise = metrics.includes("cognitive_complexity")
      ? this.fetchCognitiveComplexity(context)
      : Promise.resolve(0);

    const perFile: FileMetrics[] = [];
    for (const filePath of files) {
      const code = await fs.readFile(filePath, "utf8").catch(() => null);
      if (code === null) {
        continue;
      }

      try {
        perFile.push(this.analyzeFile(code, filePath));
      } catch {
        continue;
      }
    }

    const [cognitiveComplexity, eslintCounts] = await Promise.all([
      cognitiveComplexityPromise,
      eslintCountsPromise
    ]);
    const summary = this.buildSummary(perFile, cognitiveComplexity, eslintCounts);
    const values: MetricValues = {};
    for (const metric of metrics) {
      values[metric] = summary[metric] ?? null;
    }
    return values;
  }

  private async listFiles(folderPath: string): Promise<string[]> {
    const found = (await fg(["**/*"], {
      absolute: true,
      cwd: folderPath,
      dot: true,
      ignore: IGNORE_PATTERNS,
      onlyFiles: true
    })) as string[];

    return found
      .filter((filePath: string) => JS_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
      .sort((a: string, b: string) => a.localeCompare(b));
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
      sourceType: "unambiguous",
      tokens: true
    }) as unknown as AstNode;
  }

  private analyzeFile(code: string, filePath: string): FileMetrics {
    const ast = this.parseCode(code, filePath);
    const astRoot = this.getProgramRoot(ast);
    const counters = {
      cyclomaticSum: 0,
      functionsAll: 0,
      functionsUser: 0,
      maxNestingDepth: 0,
      maxParams: 0,
      complexMethodsCount: 0,
      longParameterListCount: 0,
      longMethodsCount: 0
    };

    const walkFunctions = (node: AstNode, parent: AstNode | null = null) => {
      if (FUNCTION_NODES.has(node.type)) {
        counters.functionsAll += 1;
        if (this.isUserFunctionNode(node, parent)) {
          counters.functionsUser += 1;
          const metrics = this.analyzeFunctionBody(node);
          const lineCount = this.getFunctionLineCount(node);
          counters.cyclomaticSum += metrics.cyclomatic;
          counters.maxParams = Math.max(counters.maxParams, metrics.params);
          counters.maxNestingDepth = Math.max(counters.maxNestingDepth, metrics.maxNestingDepth);
          if (metrics.cyclomatic > 20) counters.complexMethodsCount += 1;
          if (metrics.params > 5) counters.longParameterListCount += 1;
          if (lineCount > 105 && metrics.cyclomatic > 9) counters.longMethodsCount += 1;
        }
      }

      for (const child of this.getChildren(node)) {
        walkFunctions(child, node);
      }
    };

    walkFunctions(astRoot);
    const smells = this.analyzeCodeSmells(astRoot);
    let halstead = { halsteadDifficulty: 0, halsteadEffort: 0, halsteadVolume: 0 };
    try {
      halstead = this.analyzeHalstead(code);
    } catch {
      // Keep the file in the report even if escomplex cannot parse Halstead data.
    }

    return {
      ...counters,
      ...smells,
      ...halstead,
      internalSimilarity: this.calculateInternalSimilarity(code),
      locCode: this.countCodeLines(code)
    };
  }

  private getProgramRoot(ast: AstNode): AstNode {
    const program = ast.program;
    return this.isNode(program) ? program : ast;
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
        if (!FUNCTION_NODES.has(child.type)) {
          walk(child, node);
        }
      }

      if (incrementsDepth) {
        depth -= 1;
      }
    };

    if (this.isNode(fnNode.body)) {
      walk(fnNode.body, fnNode);
    }
    return { cyclomatic, maxNestingDepth, params };
  }

  private analyzeCodeSmells(astRoot: AstNode) {
    const metrics = {
      deadCodeCount: 0,
      innerHtmlUsageCount: 0,
      longMessageChainsCount: 0,
      longScopeChainingCount: 0,
      switchWithoutDefaultCount: 0,
      undeclaredVariablesCount: 0,
      unusedParametersCount: 0,
      unusedVariablesCount: 0
    };
    const declarationNodeSet = new WeakSet<object>();
    const countedChainRoots = new Set<string>();
    const programScope = this.createScope("program", null);

    const finalizeScope = (scope: Scope) => {
      for (const entry of scope.declared.values()) {
        if (entry.used) continue;
        if (entry.kind === "param") metrics.unusedParametersCount += 1;
        if (entry.kind === "variable") metrics.unusedVariablesCount += 1;
      }
    };

    const walk = (
      node: AstNode,
      parent: AstNode | null = null,
      scope: Scope = programScope,
      functionDepth = 0
    ) => {
      let currentScope = scope;
      let nextFunctionDepth = functionDepth;
      let scopeCreated = false;

      if (node.type === "Program") {
        currentScope = programScope;
      } else if (FUNCTION_NODES.has(node.type)) {
        currentScope = this.createScope("function", scope);
        scopeCreated = true;
        nextFunctionDepth = functionDepth + 1;
        if (nextFunctionDepth > 3 && functionDepth <= 3) metrics.longScopeChainingCount += 1;

        for (const param of this.asNodeArray(node.params)) {
          this.declarePatternInScope(currentScope, param, "param", declarationNodeSet);
        }
        if (node.type === "FunctionExpression" && this.isIdentifier(node.id)) {
          this.declareInScope(currentScope, node.id.name, "function", node.id, declarationNodeSet);
        }
      } else if (node.type === "BlockStatement" || node.type === "CatchClause") {
        currentScope = this.createScope("block", scope);
        scopeCreated = true;
        if (node.type === "CatchClause" && this.isNode(node.param)) {
          this.declarePatternInScope(currentScope, node.param, "variable", declarationNodeSet);
        }
      }

      if (node.type === "FunctionDeclaration" && this.isIdentifier(node.id)) {
        this.declareInScope(scope, node.id.name, "function", node.id, declarationNodeSet);
      }
      if (node.type === "ClassDeclaration" && this.isIdentifier(node.id)) {
        this.declareInScope(scope, node.id.name, "class", node.id, declarationNodeSet);
      }
      if (node.type === "ImportDeclaration") {
        for (const spec of this.asNodeArray(node.specifiers)) {
          if (this.isIdentifier(spec.local)) {
            this.declareInScope(
              programScope,
              spec.local.name,
              "variable",
              spec.local,
              declarationNodeSet
            );
          }
        }
      }
      if (node.type === "VariableDeclaration") {
        const targetScope =
          node.kind === "var" ? this.resolveFunctionScope(currentScope) : currentScope;
        for (const decl of this.asNodeArray(node.declarations)) {
          if (this.isNode(decl.id)) {
            this.declarePatternInScope(targetScope, decl.id, "variable", declarationNodeSet);
          }
        }
      }

      if (node.type === "BlockStatement") {
        metrics.deadCodeCount += this.countDeadStatementsInList(this.asNodeArray(node.body));
      }
      if (node.type === "SwitchStatement") {
        const hasDefault = this.asNodeArray(node.cases).some(
          (switchCase) => switchCase.test == null
        );
        if (!hasDefault) metrics.switchWithoutDefaultCount += 1;
      }
      if (node.type === "SwitchCase") {
        metrics.deadCodeCount += this.countDeadStatementsInList(this.asNodeArray(node.consequent));
      }
      if (this.isInnerHtmlMember(node)) {
        metrics.innerHtmlUsageCount += 1;
      }
      if (this.isChainNode(node) && this.isTopLevelChainNode(node, parent)) {
        const chainLength = this.getChainLength(node);
        const chainKey = this.getNodeStableKey(node);
        if (chainLength >= 4 && !countedChainRoots.has(chainKey)) {
          countedChainRoots.add(chainKey);
          metrics.longMessageChainsCount += 1;
        }
      }
      if (this.isIdentifier(node) && this.isIdentifierReference(node, parent, declarationNodeSet)) {
        const resolved = this.markIdentifierAsUsed(node.name, currentScope);
        if (!resolved && !KNOWN_GLOBALS.has(node.name)) {
          metrics.undeclaredVariablesCount += 1;
        }
      }

      for (const child of this.getChildren(node)) {
        walk(child, node, currentScope, nextFunctionDepth);
      }
      if (scopeCreated) {
        finalizeScope(currentScope);
      }
    };

    walk(astRoot);
    finalizeScope(programScope);
    return metrics;
  }

  private analyzeHalstead(code: string) {
    const report = escomplex.analyzeModule(code);
    const halstead = report.aggregate?.halstead;
    return {
      halsteadDifficulty: Number((halstead?.difficulty ?? 0).toFixed(2)),
      halsteadEffort: Number((halstead?.effort ?? 0).toFixed(2)),
      halsteadVolume: Number((halstead?.volume ?? 0).toFixed(2))
    };
  }

  private buildSummary(
    rows: FileMetrics[],
    cognitiveComplexity: number,
    eslintCounts: { errors: number; warnings: number }
  ): Record<string, number> {
    const totals = rows.reduce(
      (acc, row) => {
        acc.locCode += row.locCode;
        acc.functionsUser += row.functionsUser;
        acc.functionsAll += row.functionsAll;
        acc.maxNestingDepth = Math.max(acc.maxNestingDepth, row.maxNestingDepth);
        acc.maxParams = Math.max(acc.maxParams, row.maxParams);
        acc.cyclomaticSum += row.cyclomaticSum;
        acc.halsteadVolumeSum += row.halsteadVolume;
        acc.halsteadDifficultySum += row.halsteadDifficulty;
        acc.halsteadEffortSum += row.halsteadEffort;
        acc.similaritySum += row.internalSimilarity;
        acc.complexMethodsCount += row.complexMethodsCount;
        acc.longParameterListCount += row.longParameterListCount;
        acc.deadCodeCount += row.deadCodeCount;
        acc.longMethodsCount += row.longMethodsCount;
        acc.unusedParametersCount += row.unusedParametersCount;
        acc.unusedVariablesCount += row.unusedVariablesCount;
        acc.undeclaredVariablesCount += row.undeclaredVariablesCount;
        acc.longMessageChainsCount += row.longMessageChainsCount;
        acc.longScopeChainingCount += row.longScopeChainingCount;
        acc.innerHtmlUsageCount += row.innerHtmlUsageCount;
        acc.switchWithoutDefaultCount += row.switchWithoutDefaultCount;
        return acc;
      },
      {
        complexMethodsCount: 0,
        cyclomaticSum: 0,
        deadCodeCount: 0,
        functionsAll: 0,
        functionsUser: 0,
        halsteadDifficultySum: 0,
        halsteadEffortSum: 0,
        halsteadVolumeSum: 0,
        innerHtmlUsageCount: 0,
        locCode: 0,
        longMessageChainsCount: 0,
        longMethodsCount: 0,
        longParameterListCount: 0,
        longScopeChainingCount: 0,
        maxNestingDepth: 0,
        maxParams: 0,
        similaritySum: 0,
        switchWithoutDefaultCount: 0,
        undeclaredVariablesCount: 0,
        unusedParametersCount: 0,
        unusedVariablesCount: 0
      }
    );

    const filesCount = rows.length;
    const cyclomaticAvg =
      totals.functionsUser > 0 ? totals.cyclomaticSum / totals.functionsUser : 0;
    const averageFunctionSize =
      totals.functionsUser > 0 ? totals.locCode / totals.functionsUser : 0;
    const avgSimilarity = filesCount > 0 ? totals.similaritySum / filesCount : 0;
    const maintainabilityValues = rows.map((row) =>
      this.calculateFileMaintainability(
        row.locCode || 1,
        row.cyclomaticSum || 0,
        row.halsteadVolume || 1
      )
    );
    const maintainability =
      maintainabilityValues.length > 0
        ? maintainabilityValues.reduce((sum, value) => sum + value, 0) /
          maintainabilityValues.length
        : 0;

    return {
      average_function_size: this.round(averageFunctionSize),
      cognitive_complexity: cognitiveComplexity,
      complex_methods_count: totals.complexMethodsCount,
      cyclomatic_complexity_avg: this.round(cyclomaticAvg),
      cyclomatic_complexity_sum: totals.cyclomaticSum,
      dead_code_count: totals.deadCodeCount,
      eslint_errors_count: eslintCounts.errors,
      eslint_warnings_count: eslintCounts.warnings,
      files_count: filesCount,
      functions_count_all: totals.functionsAll,
      functions_count_user: totals.functionsUser,
      halstead_difficulty: this.round(
        filesCount > 0 ? totals.halsteadDifficultySum / filesCount : 0
      ),
      halstead_effort: this.round(totals.halsteadEffortSum),
      halstead_volume: this.round(totals.halsteadVolumeSum),
      inner_html_usage_count: totals.innerHtmlUsageCount,
      internal_similarity: this.round(avgSimilarity),
      lines_of_code: totals.locCode,
      long_message_chains_count: totals.longMessageChainsCount,
      long_methods_count: totals.longMethodsCount,
      long_parameter_list_count: totals.longParameterListCount,
      long_scope_chaining_count: totals.longScopeChainingCount,
      maintainability: this.round(maintainability),
      max_parameters_per_function: totals.maxParams,
      maximum_nesting_depth: totals.maxNestingDepth,
      switch_without_default_count: totals.switchWithoutDefaultCount,
      undeclared_variables_count: totals.undeclaredVariablesCount,
      unused_parameters_count: totals.unusedParametersCount,
      unused_variables_count: totals.unusedVariablesCount
    };
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
    const projectName = this.buildAnalysisProjectName(context);
    const task = await this.runSonarScanner({
      host,
      projectKey,
      projectName,
      scannerBin,
      sourcePath: rootPath,
      token
    });
    if (!task) return null;

    const taskCompleted = await this.waitForSonarTask(host, token, task.ceTaskId);
    return taskCompleted ? projectKey : null;
  }

  private async runSonarScanner(input: {
    host: string;
    projectKey: string;
    projectName: string;
    scannerBin: string;
    sourcePath: string;
    token: string;
  }): Promise<SonarTaskResponse | null> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sonar-js-"));
    const reportPath = path.join(tempDir, "report-task.txt");
    try {
      const args = [
        `-Dsonar.host.url=${input.host}`,
        `-Dsonar.projectKey=${input.projectKey}`,
        `-Dsonar.projectName=${input.projectName}`,
        `-Dsonar.projectBaseDir=${input.sourcePath}`,
        "-Dsonar.sources=.",
        `-Dsonar.working.directory=${path.join(tempDir, ".scannerwork")}`,
        `-Dsonar.scanner.metadataFilePath=${reportPath}`,
        "-Dsonar.sourceEncoding=UTF-8",
        "-Dsonar.inclusions=**/*.js,**/*.jsx,**/*.mjs,**/*.cjs,**/*.ts,**/*.tsx,**/*.html,**/*.htm",
        "-Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/.git/**,**/.next/**,**/out/**",
        "-Dsonar.scm.disabled=true",
        "-Dsonar.cpd.exclusions=**/*",
        "-Dsonar.javascript.file.suffixes=.js,.jsx,.mjs,.cjs",
        "-Dsonar.typescript.file.suffixes=.ts,.tsx"
      ];
      if (input.token) {
        args.push(`-Dsonar.token=${input.token}`);
      }

      const { stderr } = await this.execFileAsync(input.scannerBin, args, {
        cwd: input.sourcePath,
        maxBuffer: 50 * 1024 * 1024,
        windowsHide: true
      });
      if (stderr?.trim()) {
        this.logger.warn(`SonarQube scanner stderr for ${input.sourcePath}: ${stderr.trim()}`);
      }

      const task = await this.readSonarTaskReport(reportPath);
      if (!task?.ceTaskId) {
        this.logger.warn(
          `SonarQube scanner did not create report-task.txt for ${input.sourcePath}`
        );
        return null;
      }
      return task;
    } catch (error) {
      const execError = error as { message?: string; stderr?: string; stdout?: string };
      const details = [execError.message, execError.stderr, execError.stdout]
        .filter(Boolean)
        .join("\n")
        .trim();
      const message = details || String(error);
      this.logger.warn(`SonarQube scanner failed for ${input.sourcePath}: ${message}`);
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
      if (status === "FAILED" || status === "CANCELED") {
        this.logger.warn(`SonarQube task ${taskId} finished with status=${status}`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    this.logger.warn(`SonarQube task ${taskId} timed out`);
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
      if (!response.ok) {
        this.logger.warn(`SonarQube request failed: ${response.status} component=${componentKey}`);
        return null;
      }
      const data = (await response.json()) as {
        component?: { measures?: Array<{ metric?: string; value?: string }> };
      };
      const measure = data.component?.measures?.find(
        (item) => item.metric === "cognitive_complexity"
      );
      return Number(measure?.value ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SonarQube request failed for component=${componentKey}: ${message}`);
      return null;
    }
  }

  private buildAnalysisProjectKey(context: MetricComputeContext): string {
    const rootPath = context.rootAbsolutePath || context.absolutePath;
    const source = context.runId || rootPath;
    const hash = createHash("sha256").update(source).digest("hex").slice(0, 24);

    return `sca-js:${hash}`;
  }

  private buildAnalysisProjectName(context: MetricComputeContext): string {
    const segments = String(context.relativePath || "")
      .split(/[\\/]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((segment) => segment !== ".");
    const label = segments[0] || "analysis";
    return `JS ${label}`.slice(0, 80);
  }

  private buildSonarComponentKey(projectKey: string, context: MetricComputeContext): string {
    const rootPath = context.rootAbsolutePath || context.absolutePath;
    const relRaw = path.relative(rootPath, context.absolutePath);
    if (!relRaw || relRaw === ".") {
      return projectKey;
    }
    if (relRaw.startsWith("..") || path.isAbsolute(relRaw)) {
      return projectKey;
    }
    return `${projectKey}:${relRaw.replace(/\\/g, "/")}`;
  }

  private async runEslintIfEnabled(
    folderPath: string
  ): Promise<{ errors: number; warnings: number }> {
    if (this.config.get<string>("JS_ESLINT_ENABLED", "false") !== "true") {
      return { errors: 0, warnings: 0 };
    }
    const eslintBin = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      process.platform === "win32" ? "eslint.cmd" : "eslint"
    );
    try {
      await fs.access(eslintBin);
    } catch {
      this.logger.warn(`ESLint skipped: binary not found at ${eslintBin}`);
      return { errors: 0, warnings: 0 };
    }
    try {
      const { stdout } = await this.execFileAsync(eslintBin, [".", "--format", "json"], {
        cwd: folderPath,
        maxBuffer: 50 * 1024 * 1024,
        windowsHide: true
      });
      return this.parseEslintJson(stdout);
    } catch (error) {
      const output = (error as { stdout?: string }).stdout || "";
      return output ? this.parseEslintJson(output) : { errors: 0, warnings: 0 };
    }
  }

  private parseEslintJson(output: string): { errors: number; warnings: number } {
    try {
      const report = JSON.parse(output) as Array<{ errorCount?: number; warningCount?: number }>;
      return report.reduce(
        (acc, file) => ({
          errors: acc.errors + Number(file.errorCount || 0),
          warnings: acc.warnings + Number(file.warningCount || 0)
        }),
        { errors: 0, warnings: 0 }
      );
    } catch {
      return { errors: 0, warnings: 0 };
    }
  }

  private createScope(type: Scope["type"], parent: Scope | null): Scope {
    return { declared: new Map(), parent, type };
  }

  private declareInScope(
    scope: Scope,
    name: string,
    kind: ScopeEntry["kind"],
    node: AstNode | null,
    declarationNodeSet: WeakSet<object>
  ) {
    if (node) declarationNodeSet.add(node);
    if (!scope.declared.has(name)) {
      scope.declared.set(name, { kind, name, node, used: false });
    }
  }

  private declarePatternInScope(
    scope: Scope,
    pattern: AstNode,
    kind: ScopeEntry["kind"],
    declarationNodeSet: WeakSet<object>
  ) {
    for (const id of this.collectPatternIdentifiers(pattern)) {
      this.declareInScope(scope, id.name, kind, id, declarationNodeSet);
    }
  }

  private collectPatternIdentifiers(
    pattern: AstNode | null | undefined
  ): Array<AstNode & { name: string }> {
    if (!pattern) return [];
    if (this.isIdentifier(pattern)) return [pattern];
    if (pattern.type === "RestElement" && this.isNode(pattern.argument)) {
      return this.collectPatternIdentifiers(pattern.argument);
    }
    if (pattern.type === "AssignmentPattern" && this.isNode(pattern.left)) {
      return this.collectPatternIdentifiers(pattern.left);
    }
    if (pattern.type === "ArrayPattern") {
      return this.asNodeArray(pattern.elements).flatMap((item) =>
        this.collectPatternIdentifiers(item)
      );
    }
    if (pattern.type === "ObjectPattern") {
      return this.asNodeArray(pattern.properties).flatMap((property) => {
        if (property.type === "ObjectProperty" && this.isNode(property.value)) {
          return this.collectPatternIdentifiers(property.value);
        }
        if (property.type === "RestElement" && this.isNode(property.argument)) {
          return this.collectPatternIdentifiers(property.argument);
        }
        return [];
      });
    }
    return [];
  }

  private resolveFunctionScope(scope: Scope): Scope {
    let current: Scope | null = scope;
    while (current) {
      if (current.type === "function" || current.type === "program") return current;
      current = current.parent;
    }
    return scope;
  }

  private markIdentifierAsUsed(name: string, scope: Scope): boolean {
    let current: Scope | null = scope;
    while (current) {
      const entry = current.declared.get(name);
      if (entry) {
        entry.used = true;
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private isIdentifierReference(
    node: AstNode,
    parent: AstNode | null,
    declarationNodeSet: WeakSet<object>
  ): boolean {
    if (!parent || !this.isIdentifier(node)) return Boolean(!parent);
    if (declarationNodeSet.has(node)) return false;
    if (this.isMemberNode(parent) && parent.property === node && !parent.computed) return false;
    if (
      (parent.type === "ObjectProperty" || parent.type === "ObjectMethod") &&
      parent.key === node &&
      !parent.computed
    )
      return false;
    if (
      ["LabeledStatement", "BreakStatement", "ContinueStatement"].includes(parent.type) &&
      parent.label === node
    )
      return false;
    if (parent.type.startsWith("Import")) return false;
    if (parent.type === "ExportSpecifier") return false;
    return true;
  }

  private countDeadStatementsInList(statements: AstNode[]): number {
    let deadCount = 0;
    let unreachable = false;
    for (const statement of statements) {
      if (unreachable) {
        deadCount += 1;
        continue;
      }
      if (
        ["ReturnStatement", "ThrowStatement", "ContinueStatement", "BreakStatement"].includes(
          statement.type
        )
      ) {
        unreachable = true;
      }
    }
    return deadCount;
  }

  private isUserFunctionNode(fnNode: AstNode, parent: AstNode | null): boolean {
    if (
      ["FunctionDeclaration", "ObjectMethod", "ClassMethod", "ClassPrivateMethod"].includes(
        fnNode.type
      )
    )
      return true;
    if (parent?.type === "VariableDeclarator" && this.isIdentifier(parent.id)) return true;
    if (parent?.type === "AssignmentExpression") return true;
    if (parent?.type === "ObjectProperty") return true;
    if (parent?.type === "ExportDefaultDeclaration") return true;
    if (fnNode.type === "FunctionExpression" && this.isIdentifier(fnNode.id)) return true;
    return false;
  }

  private getFunctionLineCount(fnNode: AstNode): number {
    const start = fnNode.loc?.start?.line || 0;
    const end = fnNode.loc?.end?.line || 0;
    return start && end >= start ? end - start + 1 : 0;
  }

  private isInnerHtmlMember(node: AstNode): boolean {
    return (
      this.isMemberNode(node) &&
      !node.computed &&
      this.isIdentifier(node.property) &&
      node.property.name === "innerHTML"
    );
  }

  private isChainNode(node: AstNode): boolean {
    return (
      this.isMemberNode(node) ||
      node.type === "CallExpression" ||
      node.type === "OptionalCallExpression"
    );
  }

  private isTopLevelChainNode(node: AstNode, parent: AstNode | null): boolean {
    if (!parent) return true;
    const parentContinuesChain =
      (this.isMemberNode(parent) && parent.object === node) ||
      ((parent.type === "CallExpression" || parent.type === "OptionalCallExpression") &&
        parent.callee === node);
    return !parentContinuesChain;
  }

  private getChainLength(node: AstNode): number {
    let current: unknown = node;
    let count = 0;
    while (this.isNode(current)) {
      if (this.isMemberNode(current)) {
        count += 1;
        current = current.object;
        continue;
      }
      if (current.type === "CallExpression" || current.type === "OptionalCallExpression") {
        current = current.callee;
        continue;
      }
      if (
        this.isIdentifier(current) ||
        current.type === "ThisExpression" ||
        current.type === "Super"
      ) {
        count += 1;
      }
      break;
    }
    return count;
  }

  private getNodeStableKey(node: AstNode): string {
    const start = node.loc?.start;
    const end = node.loc?.end;
    return `${node.type}:${start?.line || 0}:${start?.column || 0}:${end?.line || 0}:${end?.column || 0}`;
  }

  private getFileBlocks(code: string, blockSize = 3): string[] {
    const lines = code
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const blocks: string[] = [];
    for (let index = 0; index <= lines.length - blockSize; index += 1) {
      blocks.push(lines.slice(index, index + blockSize).join("\n"));
    }
    return blocks;
  }

  private calculateInternalSimilarity(code: string): number {
    const blocks = this.getFileBlocks(code);
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

  private calculateFileMaintainability(
    loc: number,
    cyclomaticSum: number,
    halsteadVolume: number
  ): number {
    if (loc <= 0 || cyclomaticSum < 0 || halsteadVolume <= 0) return 100;
    const raw = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticSum - 16.2 * Math.log(loc);
    return Math.max(0, Math.min(100, (raw * 100) / 171));
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  private asNodeArray(value: unknown): AstNode[] {
    return Array.isArray(value) ? value.filter((item): item is AstNode => this.isNode(item)) : [];
  }

  private isIdentifier(value: unknown): value is AstNode & { name: string } {
    return this.isNode(value) && value.type === "Identifier" && typeof value.name === "string";
  }

  private isMemberNode(value: unknown): value is AstNode & {
    computed?: boolean;
    object?: unknown;
    property?: unknown;
  } {
    return (
      this.isNode(value) &&
      (value.type === "MemberExpression" || value.type === "OptionalMemberExpression")
    );
  }
}
