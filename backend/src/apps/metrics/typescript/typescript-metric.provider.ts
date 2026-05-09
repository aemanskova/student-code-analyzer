import { Injectable } from "@nestjs/common";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DirectionMetricProvider, MetricComputeContext, MetricValues } from "../metrics.types";
import { JS_METRICS, JsMetricProvider } from "../js/js-metric.provider";
import fg = require("fast-glob");
import ts = require("typescript");

const TS_METRICS = [
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
];

const TS_METRIC_SET = new Set(TS_METRICS);
const JS_METRIC_SET = new Set(JS_METRICS);

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/out/**",
  "**/coverage/**",
  "**/*.d.ts",
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/*.test.tsx",
  "**/*.spec.tsx"
];

const THREAD_SAFETY_WORDS = new Set([
  "thread",
  "safe",
  "safety",
  "concurrency",
  "race",
  "atomic",
  "mutex",
  "lock",
  "worker"
]);

type ApiCallable = {
  name: string;
  node: ts.FunctionLikeDeclaration | ts.MethodDeclaration;
  owner?: string;
};

type Summary = Record<string, number | boolean>;

@Injectable()
export class TypeScriptMetricProvider implements DirectionMetricProvider {
  readonly direction = "typescript";
  readonly supportedMetrics = [...JS_METRICS, ...TS_METRICS];

  constructor(private readonly jsMetricProvider: JsMetricProvider) {}

  async computeSelected(context: MetricComputeContext, metrics: string[]): Promise<MetricValues> {
    const jsMetrics = metrics.filter((metric) => JS_METRIC_SET.has(metric));
    const tsMetrics = metrics.filter((metric) => TS_METRIC_SET.has(metric));
    const values: MetricValues = {};

    if (jsMetrics.length) {
      Object.assign(values, await this.jsMetricProvider.computeSelected(context, jsMetrics));
    }

    if (!tsMetrics.length) {
      return values;
    }

    const files = await this.listFiles(context.absolutePath);
    if (!files.length) {
      for (const metric of tsMetrics) {
        values[metric] = null;
      }
      return values;
    }

    const { program, compilerOptions, filesSet } = await this.createProgram(
      context.absolutePath,
      files
    );
    const checker = program.getTypeChecker();
    const sourceFiles = program
      .getSourceFiles()
      .filter((sourceFile) => filesSet.has(path.resolve(sourceFile.fileName)));

    const summary = this.buildSummary(sourceFiles, checker, program, compilerOptions);
    for (const metric of tsMetrics) {
      values[metric] = summary[metric] ?? null;
    }
    return values;
  }

  private async listFiles(folderPath: string): Promise<string[]> {
    const found = (await fg(["**/*.ts", "**/*.tsx"], {
      absolute: true,
      cwd: folderPath,
      dot: true,
      ignore: IGNORE_PATTERNS,
      onlyFiles: true
    })) as string[];

    return found.map((filePath) => path.resolve(filePath)).sort((a, b) => a.localeCompare(b));
  }

  private async createProgram(targetPath: string, files: string[]) {
    const tsconfigPath = await this.resolveTsconfigPath(targetPath);
    const fallbackOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      skipLibCheck: true
    };

    if (!tsconfigPath) {
      const program = ts.createProgram(files, fallbackOptions);
      return { program, compilerOptions: fallbackOptions, filesSet: new Set(files) };
    }

    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      const program = ts.createProgram(files, fallbackOptions);
      return { program, compilerOptions: fallbackOptions, filesSet: new Set(files) };
    }

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsconfigPath),
      { skipLibCheck: true },
      tsconfigPath
    );
    const program = ts.createProgram(files, parsed.options);
    return { program, compilerOptions: parsed.options, filesSet: new Set(files) };
  }

  private async resolveTsconfigPath(targetPath: string): Promise<string | null> {
    const candidates = [
      path.join(targetPath, "tsconfig.json"),
      path.join(path.dirname(targetPath), "tsconfig.json")
    ];
    for (const candidate of candidates) {
      const exists = await fs
        .stat(candidate)
        .then((stat) => stat.isFile())
        .catch(() => false);
      if (exists) {
        return candidate;
      }
    }
    return null;
  }

  private buildSummary(
    sourceFiles: ts.SourceFile[],
    checker: ts.TypeChecker,
    program: ts.Program,
    compilerOptions: ts.CompilerOptions
  ): Summary {
    let locPhysical = 0;
    let chainMax = 0;
    let asyncUsage = 0;
    let mlocSum = 0;
    let mlocCount = 0;
    let mlocMax = 0;
    let throwTotal = 0;
    let throwTyped = 0;
    let catchTotal = 0;
    let catchNarrowed = 0;
    let explicitAnyCount = 0;
    let explicitUnknownCount = 0;
    let typeAssertionCount = 0;
    let resultEitherReturnCount = 0;

    const apiCallables: ApiCallable[] = [];

    for (const sourceFile of sourceFiles) {
      const text = sourceFile.getFullText();
      locPhysical += text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;

      const visit = (node: ts.Node) => {
        if (node.kind === ts.SyntaxKind.AnyKeyword) explicitAnyCount += 1;
        if (node.kind === ts.SyntaxKind.UnknownKeyword) explicitUnknownCount += 1;
        if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) typeAssertionCount += 1;
        if (ts.isAwaitExpression(node)) asyncUsage += 1;

        if (this.isFunctionLikeDeclaration(node)) {
          if (this.hasModifier(node, ts.SyntaxKind.AsyncKeyword)) asyncUsage += 1;
          if (node.body) {
            const mloc = this.countNonEmptyLinesInRange(
              sourceFile,
              text,
              node.body.getStart(sourceFile),
              node.body.end
            );
            mlocSum += mloc;
            mlocCount += 1;
            mlocMax = Math.max(mlocMax, mloc);

            const signature = checker.getSignatureFromDeclaration(node);
            const returnType = signature ? checker.typeToString(signature.getReturnType()) : "";
            if (
              returnType.includes("Result<") ||
              returnType.includes("Either<") ||
              returnType.includes("Promise<Result<") ||
              returnType.includes("Promise<Either<")
            ) {
              resultEitherReturnCount += 1;
            }
          }
        }

        if (ts.isCallExpression(node)) {
          if (ts.isPropertyAccessExpression(node.expression)) {
            const name = node.expression.name.text;
            if (name === "then" || name === "catch" || name === "finally") asyncUsage += 1;
          }
        }

        if (ts.isNewExpression(node) && node.expression.getText(sourceFile) === "Promise") {
          asyncUsage += 1;
        }

        if (this.isChainNode(node) && this.isTopOfChain(node)) {
          const length = this.chainLengthFromTop(node);
          if (length >= 2) chainMax = Math.max(chainMax, length);
        }

        if (ts.isThrowStatement(node)) {
          throwTotal += 1;
          if (node.expression && ts.isNewExpression(node.expression)) {
            const thrownType = checker.getTypeAtLocation(node.expression);
            if (this.isCustomErrorLike(thrownType)) throwTyped += 1;
          }
        }

        if (ts.isCatchClause(node)) {
          catchTotal += 1;
          const catchName = node.variableDeclaration?.name;
          if (
            catchName &&
            ts.isIdentifier(catchName) &&
            this.catchHasNarrowing(node.block, catchName.text)
          ) {
            catchNarrowed += 1;
          }
        }

        this.collectApiCallable(node, apiCallables);
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    const ADI = this.computeDocumentationIndex(apiCallables);
    const AMNOI = this.computeOverloadingIndex(apiCallables, checker);
    const AMGI = this.computeMethodGroupingIndex(sourceFiles);
    const APLCI = this.computeParameterListConsistencyIndex(apiCallables);
    const APXI = this.computeParameterListComplexityIndex(apiCallables, checker);
    const discriminatedUnionShare = this.computeDiscriminatedUnionShare(sourceFiles, checker);
    const genericPrecision = this.computeGenericPrecisionScore(apiCallables, checker);
    const implicitAnyCount = this.countImplicitAnyDiagnostics(program);
    const strictEnabled = compilerOptions.strict === true;
    const typedThrowsRatio = throwTotal > 0 ? throwTyped / throwTotal : 0;
    const catchNarrowingRatio = catchTotal > 0 ? catchNarrowed / catchTotal : 0;
    const resultUsageRatio =
      apiCallables.length > 0 ? resultEitherReturnCount / apiCallables.length : 0;
    const typedErrorHandlingScore = this.clamp(
      0,
      0.4 * typedThrowsRatio + 0.3 * catchNarrowingRatio + 0.3 * resultUsageRatio,
      1
    );
    const loc = locPhysical || 1;

    return {
      LOC: locPhysical,
      "MLOC avg": Number((mlocCount ? mlocSum / mlocCount : 0).toFixed(2)),
      "MLOC max": mlocMax,
      ADI: Number(ADI.toFixed(3)),
      "AESI (typed throws ratio)": Number(typedThrowsRatio.toFixed(3)),
      AMGI: Number(AMGI.toFixed(3)),
      "AMNOI (перегрузки функций)": Number(AMNOI.toFixed(3)),
      APLCI: Number(APLCI.toFixed(3)),
      APXI: Number(APXI.toFixed(3)),
      "ASYNC_USAGE total (async function + await + then/catch/finally + new Promise)": asyncUsage,
      "ASYNC_USAGE per LOC": Number((asyncUsage / loc).toFixed(6)),
      "CHAIN_LENGTH max (длинные цепочки вызовов/обращений)": chainMax,
      "Discriminated Unions share (Tagged Union)": Number(discriminatedUnionShare.toFixed(3)),
      "explicit any count": explicitAnyCount,
      "explicit unknown count": explicitUnknownCount,
      "Files count analyzed": sourceFiles.length,
      "Generic Precision score": Number(genericPrecision.toFixed(3)),
      "implicit any count (diagnostics)": implicitAnyCount,
      "strict enabled": strictEnabled,
      "type assertions count (as/<T>)": typeAssertionCount,
      "Typed Error Handling score": Number(typedErrorHandlingScore.toFixed(3))
    };
  }

  private collectApiCallable(node: ts.Node, apiCallables: ApiCallable[]): void {
    if (ts.isFunctionDeclaration(node) && node.name && this.hasExportModifier(node)) {
      apiCallables.push({ name: node.name.text, node });
      return;
    }

    if (ts.isVariableStatement(node) && this.hasExportModifier(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          apiCallables.push({ name: declaration.name.text, node: declaration.initializer });
        }
      }
      return;
    }

    if (ts.isClassDeclaration(node) && node.name && this.hasExportModifier(node)) {
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !this.isPublicMember(member)) {
          continue;
        }
        const name = member.name.getText();
        apiCallables.push({ name, node: member, owner: node.name.text });
      }
    }
  }

  private computeDocumentationIndex(apiCallables: ApiCallable[]): number {
    if (!apiCallables.length) return 0;
    const documented = apiCallables.filter(
      (callable) => this.wordsCount(this.getJsDocText(callable.node)) >= 10
    ).length;
    return documented / apiCallables.length;
  }

  private computeThreadSafetyIndex(apiCallables: ApiCallable[]): number {
    if (!apiCallables.length) return 0;
    const tagged = apiCallables.filter((callable) =>
      this.hasThreadSafetyWords(this.getJsDocText(callable.node))
    ).length;
    return tagged / apiCallables.length;
  }

  private computeOverloadingIndex(apiCallables: ApiCallable[], checker: ts.TypeChecker): number {
    const values: number[] = [];
    const seen = new Set<string>();
    for (const callable of apiCallables) {
      const key = `${callable.name}@${callable.owner || "global"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const type = checker.getTypeAtLocation(callable.node);
      const signatures = type.getCallSignatures();
      if (signatures.length <= 1) continue;
      const returnTypes = signatures.map((signature) =>
        checker.typeToString(signature.getReturnType()).trim()
      );
      values.push(new Set(returnTypes).size / signatures.length);
    }
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private computeMethodGroupingIndex(sourceFiles: ts.SourceFile[]): number {
    const keywords = new Set([
      "get",
      "set",
      "add",
      "remove",
      "delete",
      "create",
      "update",
      "fetch",
      "load",
      "save",
      "map",
      "merge",
      "concat",
      "filter",
      "find",
      "build",
      "parse",
      "to"
    ]);
    const values: number[] = [];

    for (const sourceFile of sourceFiles) {
      const visit = (node: ts.Node) => {
        if (ts.isClassDeclaration(node) && this.hasExportModifier(node)) {
          const sequence = node.members
            .filter(
              (member): member is ts.MethodDeclaration =>
                ts.isMethodDeclaration(member) && this.isPublicMember(member)
            )
            .map(
              (method) =>
                this.tokenizeName(method.name.getText()).find((token) => keywords.has(token)) ||
                null
            )
            .filter((token): token is string => Boolean(token));

          if (sequence.length >= 2) {
            let runs = 1;
            for (let index = 1; index < sequence.length; index += 1) {
              if (sequence[index] !== sequence[index - 1]) runs += 1;
            }
            values.push(sequence.length / runs);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private computeParameterListConsistencyIndex(apiCallables: ApiCallable[]): number {
    const groups = new Map<string, string[]>();
    for (const callable of apiCallables) {
      const key = this.canonicalGroupKey(callable.name);
      if (!key || !callable.node.parameters.length) continue;
      const signature = callable.node.parameters
        .map((parameter) => parameter.name.getText().toLowerCase())
        .join(",");
      groups.set(key, [...(groups.get(key) || []), signature]);
    }

    const values: number[] = [];
    for (const signatures of groups.values()) {
      if (signatures.length < 2) continue;
      const counts = new Map<string, number>();
      for (const signature of signatures) counts.set(signature, (counts.get(signature) || 0) + 1);
      values.push(Math.max(...counts.values()) / signatures.length);
    }
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private computeParameterListComplexityIndex(
    apiCallables: ApiCallable[],
    checker: ts.TypeChecker
  ): number {
    const values: number[] = [];
    for (const callable of apiCallables) {
      const parameters = callable.node.parameters;
      if (!parameters.length) continue;
      const types = parameters.map((parameter) =>
        checker.typeToString(checker.getTypeAtLocation(parameter))
      );
      let runsSame = 0;
      for (let index = 1; index < types.length; index += 1) {
        if (types[index] === types[index - 1]) runsSame += 1;
      }
      const optional = parameters.filter((parameter) => Boolean(parameter.questionToken)).length;
      const rest = parameters.filter((parameter) => Boolean(parameter.dotDotDotToken)).length;
      values.push(parameters.length + runsSame + 0.5 * optional + rest);
    }
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private computeDiscriminatedUnionShare(
    sourceFiles: ts.SourceFile[],
    checker: ts.TypeChecker
  ): number {
    let unionCount = 0;
    let discriminatedCount = 0;

    for (const sourceFile of sourceFiles) {
      const visit = (node: ts.Node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          const unionType = checker.getTypeAtLocation(node.type);
          if (unionType.isUnion()) {
            unionCount += 1;
            const parts = unionType.types;
            const commonNames = this.getCommonPropertyNames(parts);
            if (
              commonNames.some((name) =>
                parts.every((part) => this.hasLiteralProperty(part, name, checker, node))
              )
            ) {
              discriminatedCount += 1;
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    return unionCount ? discriminatedCount / unionCount : 0;
  }

  private computeGenericPrecisionScore(
    apiCallables: ApiCallable[],
    checker: ts.TypeChecker
  ): number {
    let totalTypeParams = 0;
    let constrainedTypeParams = 0;
    let genericDeclCount = 0;
    let highArityCount = 0;
    let anyLeakCount = 0;

    for (const callable of apiCallables) {
      const typeParameters = callable.node.typeParameters || [];
      if (!typeParameters.length) continue;
      genericDeclCount += 1;
      totalTypeParams += typeParameters.length;
      if (typeParameters.length > 2) highArityCount += 1;
      constrainedTypeParams += typeParameters.filter((typeParameter) =>
        Boolean(typeParameter.constraint)
      ).length;

      const hasAnyInParams = callable.node.parameters.some((parameter) =>
        this.isAnyType(checker.getTypeAtLocation(parameter))
      );
      const signature = checker.getSignatureFromDeclaration(callable.node);
      const hasAnyInReturn = signature ? this.isAnyType(signature.getReturnType()) : false;
      if (hasAnyInParams || hasAnyInReturn) anyLeakCount += 1;
    }

    const constraintRate = totalTypeParams ? constrainedTypeParams / totalTypeParams : 0;
    const highArityRate = genericDeclCount ? highArityCount / genericDeclCount : 0;
    const anyLeakRate = genericDeclCount ? anyLeakCount / genericDeclCount : 0;
    return this.clamp(0, 0.6 * constraintRate + 0.4 * (1 - anyLeakRate) - 0.1 * highArityRate, 1);
  }

  private countImplicitAnyDiagnostics(program: ts.Program): number {
    return program
      .getSemanticDiagnostics()
      .filter((diagnostic) =>
        ts
          .flattenDiagnosticMessageText(diagnostic.messageText, "\n")
          .includes("implicitly has an 'any' type")
      ).length;
  }

  private countNonEmptyLinesInRange(
    sourceFile: ts.SourceFile,
    text: string,
    start: number,
    end: number
  ): number {
    const lines = text.split(/\r?\n/);
    const startLine = sourceFile.getLineAndCharacterOfPosition(start).line;
    const endLine = sourceFile.getLineAndCharacterOfPosition(end).line;
    let count = 0;
    for (let index = startLine; index <= endLine; index += 1) {
      if ((lines[index] || "").trim().length > 0) count += 1;
    }
    return count;
  }

  private chainLengthFromTop(node: ts.Node): number {
    let length = 0;
    let current: ts.Node | undefined = node;
    while (current) {
      if (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current) ||
        ts.isCallExpression(current)
      ) {
        length += 1;
        current = current.expression;
        continue;
      }
      if (ts.isNonNullExpression(current) || ts.isAsExpression(current)) {
        current = current.expression;
        continue;
      }
      break;
    }
    return length;
  }

  private isTopOfChain(node: ts.Node): boolean {
    const parent = node.parent;
    if (!parent) return true;
    if (
      (ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent) ||
        ts.isCallExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isAsExpression(parent)) &&
      "expression" in parent &&
      parent.expression === node
    ) {
      return false;
    }
    return true;
  }

  private isChainNode(node: ts.Node): boolean {
    return (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isCallExpression(node)
    );
  }

  private isFunctionLikeDeclaration(node: ts.Node): node is ts.FunctionLikeDeclaration {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    );
  }

  private catchHasNarrowing(block: ts.Block, catchVarName: string): boolean {
    let found = false;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
        ts.isIdentifier(node.left) &&
        node.left.text === catchVarName
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(block);
    return found;
  }

  private isCustomErrorLike(type: ts.Type): boolean {
    const symbolName = type.getSymbol()?.getName() || "";
    if (symbolName && symbolName !== "Error" && symbolName.endsWith("Error")) return true;
    if (type.isClassOrInterface()) {
      return (type.getBaseTypes() || []).some(
        (baseType) => baseType.getSymbol()?.getName() === "Error"
      );
    }
    return false;
  }

  private getCommonPropertyNames(types: ts.Type[]): string[] {
    const propertySets = types.map(
      (type) => new Set(type.getProperties().map((property) => property.getName()))
    );
    if (!propertySets.length) return [];
    return Array.from(propertySets[0]).filter((name) => propertySets.every((set) => set.has(name)));
  }

  private hasLiteralProperty(
    type: ts.Type,
    propertyName: string,
    checker: ts.TypeChecker,
    node: ts.Node
  ): boolean {
    const property = type.getProperty(propertyName);
    const declaration = property?.valueDeclaration || property?.declarations?.[0];
    if (!property || !declaration) return false;
    const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration || node);
    return this.isLiteralOrUnionOfLiterals(propertyType);
  }

  private isLiteralOrUnionOfLiterals(type: ts.Type): boolean {
    if (this.isLiteralType(type)) return true;
    return type.isUnion() && type.types.every((part) => this.isLiteralType(part));
  }

  private isLiteralType(type: ts.Type): boolean {
    return Boolean(
      type.flags &
      (ts.TypeFlags.StringLiteral |
        ts.TypeFlags.NumberLiteral |
        ts.TypeFlags.BooleanLiteral |
        ts.TypeFlags.EnumLiteral)
    );
  }

  private isAnyType(type: ts.Type): boolean {
    return Boolean(type.flags & ts.TypeFlags.Any);
  }

  private getJsDocText(node: ts.Node): string {
    const sourceFile = node.getSourceFile();
    const comments = ts.getJSDocCommentsAndTags(node);
    if (comments.length) {
      return comments.map((comment) => comment.getText(sourceFile)).join(" ");
    }
    const ranges = ts.getLeadingCommentRanges(sourceFile.getFullText(), node.pos) || [];
    return ranges
      .map((range) => sourceFile.getFullText().slice(range.pos, range.end))
      .filter((text) => text.startsWith("/**"))
      .join(" ");
  }

  private wordsCount(value: string): number {
    return value.trim().split(/\s+/).filter(Boolean).length;
  }

  private hasThreadSafetyWords(value: string): boolean {
    const lower = value.toLowerCase();
    for (const word of THREAD_SAFETY_WORDS) {
      if (lower.includes(word)) return true;
    }
    return false;
  }

  private tokenizeName(name: string): string[] {
    return name
      .replace(/Async$/i, "")
      .replace(/Impl$/i, "")
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  private canonicalGroupKey(name: string): string {
    return this.tokenizeName(name)[0] || "";
  }

  private hasExportModifier(node: ts.Node): boolean {
    return this.hasModifier(node, ts.SyntaxKind.ExportKeyword);
  }

  private hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    return Boolean(
      ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind)
    );
  }

  private isPublicMember(node: ts.MethodDeclaration): boolean {
    return (
      !this.hasModifier(node, ts.SyntaxKind.PrivateKeyword) &&
      !this.hasModifier(node, ts.SyntaxKind.ProtectedKeyword)
    );
  }

  private clamp(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
