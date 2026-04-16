import { Injectable, OnModuleDestroy } from "@nestjs/common";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as http from "node:http";
import { spawn } from "node:child_process";
import * as fg from "fast-glob";
import * as parse5 from "parse5";
import * as csstree from "css-tree";
import getPort from "get-port";
import { chromium } from "playwright-core";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serveHandler = require("serve-handler");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axeCoreModule = require("axe-core");
const axeCoreRuntime = axeCoreModule?.default ?? axeCoreModule;

interface AnalyzerOptions {
  depth?: number;
  recursiveMode?: boolean;
  metrics?: string[];
  onWorkProgress?: (completed: number, total: number, currentPath: string) => Promise<void> | void;
}

interface WorkAggregate {
  path: string;
  [key: string]: string | number | boolean | null;
}

@Injectable()
export class HtmlCssFullAnalyzerService implements OnModuleDestroy {
  private static globalHeavyActive = 0;
  private static globalHeavyQueue: Array<() => void> = [];
  private sharedBrowserPromise: Promise<any> | null = null;

  readonly supportedMetrics: string[] = [
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
  ];

  private readonly IGNORE = [
    "**/bootstrap/**",
    "**/.git/**",
    "**/.github/**",
    "**/.vscode/**",
    "**/images/**",
    "**/node_modules/**",
    "**/__MACOSX/**",
    "**/._*"
  ];

  private readonly ASSET_IGNORE = [
    "**/bootstrap/**",
    "**/.git/**",
    "**/.github/**",
    "**/.vscode/**",
    "**/node_modules/**",
    "**/__MACOSX/**",
    "**/._*"
  ];

  private readonly IMAGE_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".avif",
    ".bmp",
    ".ico",
    ".tif",
    ".tiff"
  ];

  private readonly FONT_EXTENSIONS = [".woff", ".woff2", ".ttf", ".otf", ".eot"];

  async onModuleDestroy(): Promise<void> {
    if (!this.sharedBrowserPromise) {
      return;
    }
    try {
      const browser = await this.sharedBrowserPromise;
      await browser?.close?.();
    } catch {
      // ignore close errors on shutdown
    } finally {
      this.sharedBrowserPromise = null;
    }
  }

  private shouldRunMetricGroup(
    selectedMetrics: Set<string> | null,
    namesOrPrefixes: string[]
  ): boolean {
    if (!selectedMetrics) {
      return true;
    }
    for (const candidate of selectedMetrics) {
      for (const matcher of namesOrPrefixes) {
        if (matcher.endsWith("*")) {
          const prefix = matcher.slice(0, -1);
          if (candidate.startsWith(prefix)) {
            return true;
          }
        } else if (candidate === matcher) {
          return true;
        }
      }
    }
    return false;
  }

  async analyzeRoot(rootDir: string, options: AnalyzerOptions): Promise<WorkAggregate[]> {
    const workDirs = await this.collectRepoDirs(
      rootDir,
      Boolean(options.recursiveMode),
      options.depth
    );
    const selectedMetrics =
      options.metrics && options.metrics.length > 0 ? new Set(options.metrics) : null;
    const workConcurrency = Number(process.env.WORK_CONCURRENCY ?? 2);
    const totalWorks = workDirs.length;
    let completedWorks = 0;

    const rows = await this.runWithConcurrency(
      workDirs,
      workConcurrency,
      async (workDir): Promise<WorkAggregate | null> => {
        try {
          const agg = await this.analyzeWork(workDir, undefined, selectedMetrics);
          if (!agg) {
            return null;
          }
          return {
            path: this.normalizePath(path.relative(rootDir, workDir) || "."),
            ...agg
          } as WorkAggregate;
        } finally {
          completedWorks += 1;
          if (options.onWorkProgress) {
            await options.onWorkProgress(
              completedWorks,
              totalWorks,
              this.normalizePath(path.relative(rootDir, workDir) || ".")
            );
          }
        }
      }
    );

    return rows.filter((row): row is WorkAggregate => Boolean(row));
  }

  private normalizePath(value: string): string {
    return value.replace(/\\/g, "/");
  }

  private async readText(filePath: string): Promise<string> {
    return fs.readFile(filePath, "utf8");
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private isElementNode(node: any): boolean {
    return (
      node &&
      typeof node === "object" &&
      node.nodeName &&
      node.nodeName !== "#text" &&
      node.nodeName !== "#document" &&
      node.nodeName !== "#document-fragment" &&
      node.nodeName !== "#documentType"
    );
  }

  private getAttr(node: any, name: string): string | null {
    const a = node.attrs?.find((x: any) => x.name === name);
    return a ? a.value : null;
  }

  private walk(node: any, fn: (n: any, depth: number) => void, depth = 0) {
    fn(node, depth);
    const children = node.childNodes || [];
    for (const ch of children) {
      this.walk(ch, fn, depth + 1);
    }
  }

  private sum(a: number, b: number): number {
    return a + b;
  }

  private avg(arr: Array<Record<string, unknown>>, key: string): number {
    const vals = arr.map((x) => Number(x[key])).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce(this.sum.bind(this), 0) / vals.length : 0;
  }

  private max(arr: Array<Record<string, unknown>>, key: string): number {
    const vals = arr.map((x) => Number(x[key])).filter((v) => Number.isFinite(v));
    return vals.length ? Math.max(...vals) : 0;
  }

  private min(arr: Array<Record<string, unknown>>, key: string): number {
    const vals = arr.map((x) => Number(x[key])).filter((v) => Number.isFinite(v));
    return vals.length ? Math.min(...vals) : 0;
  }

  private total(arr: Array<Record<string, unknown>>, key: string): number {
    const vals = arr.map((x) => Number(x[key])).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce(this.sum.bind(this), 0) : 0;
  }

  private variance(values: number[]): number {
    const nums = values.map(Number).filter((v) => Number.isFinite(v));
    if (!nums.length) {
      return 0;
    }
    const mean = nums.reduce(this.sum.bind(this), 0) / nums.length;
    return nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / nums.length;
  }

  private async withTimeout<T>(
    run: () => Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return run();
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      run()
        .then((result) => resolve(result))
        .catch((error) => reject(error))
        .finally(() => clearTimeout(timer));
    });
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const maxWorkers = Math.max(1, Math.trunc(concurrency || 1));
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runWorker = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) {
          return;
        }
        results[index] = await worker(items[index], index);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(maxWorkers, items.length) }, () => runWorker())
    );

    return results;
  }

  private async withGlobalHeavyLimit<T>(task: () => Promise<T>): Promise<T> {
    const limit = Number(process.env.GLOBAL_HEAVY_CONCURRENCY ?? 4);
    if (!Number.isFinite(limit) || limit <= 0) {
      return task();
    }

    if (HtmlCssFullAnalyzerService.globalHeavyActive >= limit) {
      await new Promise<void>((resolve) => {
        HtmlCssFullAnalyzerService.globalHeavyQueue.push(resolve);
      });
    }

    HtmlCssFullAnalyzerService.globalHeavyActive += 1;
    try {
      return await task();
    } finally {
      HtmlCssFullAnalyzerService.globalHeavyActive -= 1;
      const next = HtmlCssFullAnalyzerService.globalHeavyQueue.shift();
      if (next) {
        next();
      }
    }
  }

  private analyzeHtmlAst(ast: any) {
    const SEMANTIC_TAGS = new Set([
      "header",
      "nav",
      "main",
      "article",
      "section",
      "aside",
      "footer",
      "figure",
      "figcaption",
      "time",
      "address",
      "details",
      "summary"
    ]);
    const LANDMARKS = ["header", "nav", "main", "footer", "aside"];
    const ROLE_LANDMARKS = new Set([
      "banner",
      "navigation",
      "main",
      "contentinfo",
      "complementary"
    ]);
    const NON_SEMANTIC_CONTAINERS = new Set(["div", "span"]);

    let elements = 0;
    let semantic = 0;
    let nonsemanticContainers = 0;
    let domNodes = 0;
    let maxDepth = 0;
    let depthSum = 0;
    let h1Count = 0;
    let headingOrderViolations = 0;
    let prevHeading: number | null = null;
    let imgTotal = 0;
    let imgMissingAlt = 0;
    let formControlsTotal = 0;
    let formControlsMissingLabel = 0;
    const idMap = new Map<string, number>();
    let duplicateIdOccurrences = 0;
    let duplicateIdValues = 0;
    const landmarksPresent = new Set<string>();
    const labelFor = new Set<string>();

    this.walk(ast, (node) => {
      if (!this.isElementNode(node)) return;
      if (node.nodeName === "label") {
        const f = this.getAttr(node, "for");
        if (f) labelFor.add(f);
      }
    });

    this.walk(ast, (node, depth) => {
      if (!this.isElementNode(node)) return;
      domNodes++;
      maxDepth = Math.max(maxDepth, depth);
      depthSum += depth;
      elements++;

      const tag = String(node.nodeName).toLowerCase();
      if (SEMANTIC_TAGS.has(tag)) semantic++;
      if (NON_SEMANTIC_CONTAINERS.has(tag)) nonsemanticContainers++;
      if (LANDMARKS.includes(tag)) landmarksPresent.add(tag);

      const role = (this.getAttr(node, "role") || "").toLowerCase();
      if (ROLE_LANDMARKS.has(role)) landmarksPresent.add(`role:${role}`);

      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        if (level === 1) h1Count++;
        if (prevHeading !== null && level > prevHeading + 1) {
          headingOrderViolations++;
        }
        prevHeading = level;
      }

      if (tag === "img") {
        imgTotal++;
        const alt = this.getAttr(node, "alt");
        if (alt === null || alt.trim() === "") imgMissingAlt++;
      }

      const id = this.getAttr(node, "id");
      if (id) {
        const prev = idMap.get(id) || 0;
        if (prev >= 1) duplicateIdOccurrences++;
        idMap.set(id, prev + 1);
      }

      if (["input", "select", "textarea"].includes(tag)) {
        const type = (this.getAttr(node, "type") || "").toLowerCase();
        const ignore = ["hidden", "submit", "button", "reset", "image"].includes(type);
        if (!ignore) {
          formControlsTotal++;
          const cid = this.getAttr(node, "id");
          const ariaLabel = this.getAttr(node, "aria-label");
          const ariaLabelledBy = this.getAttr(node, "aria-labelledby");
          const hasLabel =
            (cid && labelFor.has(cid)) ||
            (ariaLabel && ariaLabel.trim() !== "") ||
            (ariaLabelledBy && ariaLabelledBy.trim() !== "");
          if (!hasLabel) formControlsMissingLabel++;
        }
      }
    });

    for (const [, count] of idMap) {
      if (count > 1) duplicateIdValues++;
    }

    const avgDepth = domNodes > 0 ? depthSum / domNodes : 0;
    const semanticRatio = elements > 0 ? semantic / elements : 0;
    const semanticElementUsageRatio =
      semantic + nonsemanticContainers > 0 ? semantic / (semantic + nonsemanticContainers) : 0;

    return {
      dom_nodes: domNodes,
      max_dom_depth: maxDepth,
      avg_dom_depth: Number(avgDepth.toFixed(3)),
      semantic_ratio: Number(semanticRatio.toFixed(3)),
      semantic_elements_count: semantic,
      nonsemantic_container_count: nonsemanticContainers,
      semantic_element_usage_ratio: Number(semanticElementUsageRatio.toFixed(3)),
      landmarks_present: Array.from(landmarksPresent).sort(),
      h1_count: h1Count,
      heading_order_violations: headingOrderViolations,
      img_total: imgTotal,
      img_missing_alt: imgMissingAlt,
      form_controls_total: formControlsTotal,
      form_controls_missing_label: formControlsMissingLabel,
      duplicate_ids: duplicateIdOccurrences,
      duplicate_id_values: duplicateIdValues
    };
  }

  private specificityFromSelectorAst(sel: any) {
    let A = 0;
    let B = 0;
    let C = 0;
    (csstree as any).walk(sel, {
      enter: (node: any) => {
        if (node.type === "IdSelector") A++;
        else if (
          node.type === "ClassSelector" ||
          node.type === "AttributeSelector" ||
          node.type === "PseudoClassSelector"
        ) {
          if (
            node.type === "PseudoClassSelector" &&
            String(node.name || "").toLowerCase() === "where"
          )
            return;
          B++;
        } else if (node.type === "TypeSelector" || node.type === "PseudoElementSelector") C++;
      }
    });
    return { value: A * 100 + B * 10 + C };
  }

  private selectorComplexityFromAst(sel: any): number {
    let complexity = 0;
    (csstree as any).walk(sel, {
      enter: (node: any) => {
        if (
          [
            "TypeSelector",
            "ClassSelector",
            "IdSelector",
            "AttributeSelector",
            "PseudoClassSelector",
            "PseudoElementSelector",
            "Combinator"
          ].includes(node.type)
        )
          complexity++;
      }
    });
    return complexity;
  }

  private analyzeCssText(cssText: string) {
    const ast = (csstree as any).parse(cssText, {
      parseValue: true,
      parseRulePrelude: true
    });

    let rulesCount = 0;
    let selectorsCount = 0;
    let declarationsTotal = 0;
    let maxDeclarationsInRule = 0;
    let importCount = 0;
    let specificitySum = 0;
    let specificityMax = 0;
    let specificityCount = 0;
    const specificityValues: number[] = [];
    let complexSelectors = 0;
    let totalSelectorComplexity = 0;
    let maxSelectorComplexity = 0;
    const selectorComplexities: number[] = [];
    const declFreq = new Map<string, number>();
    let declCount = 0;
    const uniqueProperties = new Set<string>();

    (csstree as any).walk(ast, {
      enter: (node: any) => {
        if (node.type === "Atrule" && node.name === "import") importCount++;

        if (node.type === "Rule") {
          rulesCount++;

          if (node.prelude && node.prelude.type === "SelectorList") {
            const selectors: any[] = [];
            node.prelude.children?.forEach?.((sel: any) => selectors.push(sel));
            selectorsCount += selectors.length;

            for (const sel of selectors) {
              const spec = this.specificityFromSelectorAst(sel);
              specificitySum += spec.value;
              specificityMax = Math.max(specificityMax, spec.value);
              specificityCount++;
              specificityValues.push(spec.value);

              const complexity = this.selectorComplexityFromAst(sel);
              totalSelectorComplexity += complexity;
              maxSelectorComplexity = Math.max(maxSelectorComplexity, complexity);
              selectorComplexities.push(complexity);
              if (complexity > 6) complexSelectors++;
            }
          }

          if (node.block?.children?.forEach) {
            let declsInRule = 0;
            node.block.children.forEach((d: any) => {
              if (d.type === "Declaration") {
                declsInRule++;
                declCount++;
                uniqueProperties.add(String(d.property).trim().toLowerCase());
                const key = `${d.property}:${(csstree as any).generate(d.value)}`.trim();
                declFreq.set(key, (declFreq.get(key) || 0) + 1);
              }
            });
            declarationsTotal += declsInRule;
            maxDeclarationsInRule = Math.max(maxDeclarationsInRule, declsInRule);
          }
        }
      }
    });

    const avgDecl = rulesCount > 0 ? declarationsTotal / rulesCount : 0;
    let duplicateDecls = 0;
    for (const [, c] of declFreq) if (c > 1) duplicateDecls += c - 1;
    const dupDeclRatio = declCount > 0 ? duplicateDecls / declCount : 0;
    const avgSpec = specificityCount > 0 ? specificitySum / specificityCount : 0;
    const specificityVariance = specificityValues.length > 0 ? this.variance(specificityValues) : 0;
    const complexRatio = selectorsCount > 0 ? complexSelectors / selectorsCount : 0;
    const avgSelectorComplexity =
      selectorComplexities.length > 0 ? totalSelectorComplexity / selectorComplexities.length : 0;

    return {
      rules_count: rulesCount,
      selectors_count: selectorsCount,
      avg_declarations_per_rule: Number(avgDecl.toFixed(3)),
      max_declarations_per_rule: maxDeclarationsInRule,
      import_count: importCount,
      avg_specificity: Number(avgSpec.toFixed(3)),
      max_specificity: specificityMax,
      specificity_variance: Number(specificityVariance.toFixed(3)),
      complex_selectors_ratio: Number(complexRatio.toFixed(3)),
      avg_selector_complexity: Number(avgSelectorComplexity.toFixed(3)),
      max_selector_complexity: maxSelectorComplexity,
      total_selector_complexity: totalSelectorComplexity,
      unique_css_properties_used: uniqueProperties.size,
      dup_decl_ratio: Number(dupDeclRatio.toFixed(3)),
      _specificity_values: specificityValues,
      _selector_complexities: selectorComplexities,
      _unique_properties: Array.from(uniqueProperties)
    };
  }

  private async getFilesTotalSize(rootDir: string, relFiles: string[]): Promise<number> {
    const statConcurrency = Number(process.env.FS_STAT_CONCURRENCY ?? 32);
    const sizes = await this.runWithConcurrency(relFiles, statConcurrency, async (rel) => {
      const abs = path.join(rootDir, rel);
      try {
        const stat = await fs.stat(abs);
        return stat.isFile() ? stat.size : 0;
      } catch {
        return 0;
      }
    });
    return sizes.reduce((sum, size) => sum + (Number(size) || 0), 0);
  }

  private hasExtension(file: string, exts: string[]): boolean {
    return exts.includes(path.extname(file).toLowerCase());
  }

  private async analyzeAssetFiles(workDir: string, depth?: number) {
    const allFiles = (await fg(["**/*"], {
      cwd: workDir,
      dot: false,
      onlyFiles: true,
      ignore: this.ASSET_IGNORE,
      deep: depth && depth > 0 ? depth : undefined
    })) as string[];

    const imageFiles = allFiles.filter((f: string) => this.hasExtension(f, this.IMAGE_EXTENSIONS));
    const fontFiles = allFiles.filter((f: string) => this.hasExtension(f, this.FONT_EXTENSIONS));
    const imageBytesTotal = await this.getFilesTotalSize(workDir, imageFiles);
    const fontBytesTotal = await this.getFilesTotalSize(workDir, fontFiles);

    return {
      image_files_total: imageFiles.length,
      image_bytes_total: imageBytesTotal,
      avg_image_size_bytes:
        imageFiles.length > 0 ? Number((imageBytesTotal / imageFiles.length).toFixed(3)) : 0,
      font_files_total: fontFiles.length,
      font_bytes_total: fontBytesTotal,
      avg_font_size_bytes:
        fontFiles.length > 0 ? Number((fontBytesTotal / fontFiles.length).toFixed(3)) : 0,
      has_avif_files: imageFiles.some((f: string) => path.extname(f).toLowerCase() === ".avif"),
      has_webp_files: imageFiles.some((f: string) => path.extname(f).toLowerCase() === ".webp")
    };
  }

  private execCapture(
    cmd: string,
    args: string[]
  ): Promise<{ code: number | null; out: string; err: string }> {
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      p.stdout.on("data", (d) => (out += d.toString("utf8")));
      p.stderr.on("data", (d) => (err += d.toString("utf8")));
      p.on("error", reject);
      p.on("close", (code) => resolve({ code, out, err }));
    });
  }

  private extractJsonObject(text: string | undefined | null): any {
    if (!text || typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {}
    const firstBrace = trimmed.indexOf("{");
    const firstBracket = trimmed.indexOf("[");
    let start = -1;
    if (firstBrace >= 0 && firstBracket >= 0) start = Math.min(firstBrace, firstBracket);
    else start = Math.max(firstBrace, firstBracket);
    if (start < 0) return null;
    for (let end = trimmed.length; end > start; end--) {
      const candidate = trimmed.slice(start, end).trim();
      try {
        return JSON.parse(candidate);
      } catch {}
    }
    return null;
  }

  private async runVnuOnFiles(absHtmlPaths: string[]) {
    if (absHtmlPaths.length === 0) {
      return {
        enabled: true,
        files_checked: 0,
        errors_total: 0,
        warnings_total: 0,
        unparsed_files: 0
      };
    }

    const jar = process.env.VNU_JAR;
    if (!jar) return { enabled: false, error: "VNU_JAR is not set" };
    const jarExists = await this.exists(jar);
    if (!jarExists) return { enabled: false, error: `VNU_JAR does not exist: ${jar}` };

    const { code, out, err } = await this.withGlobalHeavyLimit(() =>
      this.execCapture("java", ["-jar", jar, "--format", "json", ...absHtmlPaths])
    );

    const combined = [out, err].filter(Boolean).join("\n").trim();
    const parsed =
      this.extractJsonObject(out) ||
      this.extractJsonObject(err) ||
      this.extractJsonObject(combined);

    if (!parsed) {
      return {
        enabled: true,
        files_checked: absHtmlPaths.length,
        errors_total: null,
        warnings_total: null,
        unparsed_files: absHtmlPaths.length,
        exit_code: code,
        raw_error: combined.slice(0, 4000) || `No parseable JSON from VNU (exit ${code})`
      };
    }

    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const errors = messages.filter((m: any) => m.type === "error").length;
    const warnings = messages.filter(
      (m: any) => m.type === "info" || m.type === "warning" || m.subType === "warning"
    ).length;

    return {
      enabled: true,
      files_checked: absHtmlPaths.length,
      errors_total: errors,
      warnings_total: warnings,
      unparsed_files: 0,
      exit_code: code
    };
  }

  private async startStaticServer(rootDir: string) {
    const port = await getPort({ port: 3000 });
    const server = http.createServer((req, res) => {
      try {
        serveHandler(req, res, { public: rootDir });
      } catch {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("static server error");
        } else {
          res.end();
        }
      }
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(port, "127.0.0.1", (e?: unknown) => (e ? reject(e) : resolve()));
    });

    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: () => new Promise<void>((resolve) => server.close(() => resolve()))
    };
  }

  private async runAxeOnPage(page: any, url: string) {
    const timeoutMs = Number(process.env.AXE_TIMEOUT_MS ?? 60000);

    try {
      const results = await this.withTimeout(
        async () => {
          await page.route("**/*", (route: any) => {
            const type = route.request().resourceType();
            if (type === "image" || type === "font" || type === "media") {
              return route.abort();
            }
            return route.continue();
          });
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
          await page.addScriptTag({ content: axeCoreRuntime.source });

          return page.evaluate(async () => {
            // @ts-ignore
            return await axe.run(document, { resultTypes: ["violations"] });
          });
        },
        timeoutMs,
        "axe"
      );

      const violations = results?.violations || [];
      const byImpact: Record<string, number> = {
        minor: 0,
        moderate: 0,
        serious: 0,
        critical: 0,
        unknown: 0
      };

      for (const v of violations) {
        const impact = v.impact || "unknown";
        if (impact in byImpact) byImpact[impact] += 1;
        else byImpact.unknown += 1;
      }

      return { enabled: true, violations_total: violations.length, by_impact: byImpact };
    } catch (e) {
      return { enabled: true, error: String(e) };
    }
  }

  private async runAxeBatch(urls: string[]): Promise<Map<string, Record<string, unknown>>> {
    const results = new Map<string, Record<string, unknown>>();
    if (urls.length === 0) {
      return results;
    }

    const browser = await this.getSharedBrowser();

    const axeConcurrency = Number(process.env.AXE_CONCURRENCY ?? 3);
    try {
      await this.runWithConcurrency(urls, axeConcurrency, async (url) => {
        const axeResult = await this.withGlobalHeavyLimit(async () => {
          const page = await browser.newPage();
          try {
            return await this.runAxeOnPage(page, url);
          } finally {
            await page.close().catch(() => {});
          }
        });
        results.set(url, axeResult as Record<string, unknown>);
        return null;
      });
    } finally {
      // shared browser is kept alive for reuse
    }

    return results;
  }

  private async getSharedBrowser(): Promise<any> {
    if (!this.sharedBrowserPromise) {
      this.sharedBrowserPromise = chromium
        .launch({
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.CHROME_PATH || undefined,
          args: ["--no-sandbox", "--disable-gpu"],
          headless: true
        })
        .catch((error: unknown) => {
          this.sharedBrowserPromise = null;
          throw error;
        });
    }

    try {
      const browser = await this.sharedBrowserPromise;
      if (browser?.isConnected?.() === false) {
        this.sharedBrowserPromise = null;
        return this.getSharedBrowser();
      }
      return browser;
    } catch (error) {
      this.sharedBrowserPromise = null;
      throw error;
    }
  }

  private async analyzeWork(
    workDir: string,
    depth?: number,
    selectedMetrics: Set<string> | null = null
  ): Promise<Record<string, unknown> | null> {
    const allFiles = (await fg(["**/*"], {
      cwd: workDir,
      dot: false,
      onlyFiles: true,
      ignore: this.IGNORE,
      deep: depth && depth > 0 ? depth : undefined
    })) as string[];
    const htmlFiles = allFiles.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ext === ".html" || ext === ".htm";
    });
    const cssFiles = allFiles.filter((f) => path.extname(f).toLowerCase() === ".css");

    if (!htmlFiles.length && !cssFiles.length) return null;

    const htmlParseConcurrency = Number(process.env.HTML_PARSE_CONCURRENCY ?? 8);
    const cssParseConcurrency = Number(process.env.CSS_PARSE_CONCURRENCY ?? 8);
    const shouldRunVnu = this.shouldRunMetricGroup(selectedMetrics, [
      "vnu_files_checked",
      "vnu_errors_total",
      "vnu_warnings_total",
      "vnu_unparsed_files"
    ]);
    const shouldRunAssetMetrics = this.shouldRunMetricGroup(selectedMetrics, [
      "image_files_total",
      "image_bytes_total",
      "avg_image_size_bytes",
      "font_files_total",
      "font_bytes_total",
      "avg_font_size_bytes",
      "uses_avif",
      "uses_webp"
    ]);
    const shouldRunHtmlAstMetrics = this.shouldRunMetricGroup(selectedMetrics, [
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
      "duplicate_id_values_total"
    ]);
    const shouldRunAxe = this.shouldRunMetricGroup(selectedMetrics, ["axe_*"]);
    const shouldParseHtml = shouldRunHtmlAstMetrics || shouldRunVnu || shouldRunAxe;

    const htmlResults = await this.runWithConcurrency(
      htmlFiles,
      htmlParseConcurrency,
      async (rel) => {
        const abs = path.join(workDir, rel);
        const txt = await this.readText(abs);
        const bytes = Buffer.byteLength(txt, "utf8");
        const hasAvifRef = /\.avif(\?|#|["')\s]|$)/i.test(txt);
        const hasWebpRef = /\.webp(\?|#|["')\s]|$)/i.test(txt);
        if (!shouldParseHtml) {
          return {
            file: rel,
            abs,
            html_size_bytes: bytes,
            _has_avif_ref: hasAvifRef,
            _has_webp_ref: hasWebpRef
          } as Record<string, unknown>;
        }
        try {
          const ast = parse5.parse(txt);
          const metrics = this.analyzeHtmlAst(ast);
          return {
            file: rel,
            abs,
            html_size_bytes: bytes,
            _has_avif_ref: hasAvifRef,
            _has_webp_ref: hasWebpRef,
            ...metrics
          } as Record<string, unknown>;
        } catch (e) {
          return {
            file: rel,
            abs,
            html_size_bytes: bytes,
            _has_avif_ref: hasAvifRef,
            _has_webp_ref: hasWebpRef,
            parse_error: String(e),
            vnu: { enabled: false, error: "parse5 failed; skipped VNU" }
          } as Record<string, unknown>;
        }
      }
    );
    const htmlBytesTotal = htmlResults.reduce(
      (sum, row) => sum + (Number(row.html_size_bytes) || 0),
      0
    );

    const vnuSummaryPromise = shouldRunVnu
      ? this.runVnuOnFiles(
          htmlResults
            .filter((row) => !row.parse_error)
            .map((row) => String(row.abs || ""))
            .filter(Boolean)
        )
      : Promise.resolve({
          enabled: false,
          skipped: true,
          files_checked: 0,
          errors_total: 0,
          warnings_total: 0,
          unparsed_files: 0
        });

    const cssPromise = this.runWithConcurrency(cssFiles, cssParseConcurrency, async (rel) => {
      const abs = path.join(workDir, rel);
      const txt = await this.readText(abs);
      const bytes = Buffer.byteLength(txt, "utf8");
      const hasAvifRef = /\.avif(\?|#|["')\s]|$)/i.test(txt);
      const hasWebpRef = /\.webp(\?|#|["')\s]|$)/i.test(txt);
      try {
        return {
          file: rel,
          css_size_bytes: bytes,
          _has_avif_ref: hasAvifRef,
          _has_webp_ref: hasWebpRef,
          ...this.analyzeCssText(txt)
        };
      } catch (e) {
        return {
          file: rel,
          css_size_bytes: bytes,
          _has_avif_ref: hasAvifRef,
          _has_webp_ref: hasWebpRef,
          parse_error: String(e)
        };
      }
    });

    const assetPromise = shouldRunAssetMetrics
      ? (async () => {
          const imageFiles = allFiles.filter((f) => this.hasExtension(f, this.IMAGE_EXTENSIONS));
          const fontFiles = allFiles.filter((f) => this.hasExtension(f, this.FONT_EXTENSIONS));
          const imageBytesTotal = await this.getFilesTotalSize(workDir, imageFiles);
          const fontBytesTotal = await this.getFilesTotalSize(workDir, fontFiles);

          return {
            image_files_total: imageFiles.length,
            image_bytes_total: imageBytesTotal,
            avg_image_size_bytes:
              imageFiles.length > 0 ? Number((imageBytesTotal / imageFiles.length).toFixed(3)) : 0,
            font_files_total: fontFiles.length,
            font_bytes_total: fontBytesTotal,
            avg_font_size_bytes:
              fontFiles.length > 0 ? Number((fontBytesTotal / fontFiles.length).toFixed(3)) : 0,
            has_avif_files: imageFiles.some((f) => path.extname(f).toLowerCase() === ".avif"),
            has_webp_files: imageFiles.some((f) => path.extname(f).toLowerCase() === ".webp")
          };
        })()
      : Promise.resolve({
          image_files_total: 0,
          image_bytes_total: 0,
          avg_image_size_bytes: 0,
          font_files_total: 0,
          font_bytes_total: 0,
          avg_font_size_bytes: 0,
          has_avif_files: false,
          has_webp_files: false
        });
    const axePromise = (async (): Promise<any[]> => {
      if (!htmlFiles.length || !shouldRunAxe) {
        return [];
      }
      const server = await this.startStaticServer(workDir);
      try {
        const urlsByFile = htmlFiles.map((rel: string) => ({
          file: rel,
          url: `${server.baseUrl}/${this.normalizePath(rel)}`
        }));
        const axeResults = await this.runAxeBatch(urlsByFile.map((x: { url: string }) => x.url));
        return urlsByFile.map((item) => ({
          file: item.file,
          url: item.url,
          axe: axeResults.get(item.url) || { enabled: true, error: "axe result missing" }
        }));
      } finally {
        await server.close();
      }
    })();

    const [cssResults, assetMetrics, auditsByHtml, vnuSummary] = await Promise.all([
      cssPromise,
      assetPromise,
      axePromise,
      vnuSummaryPromise
    ]).then((values) => [
      values[0] as any[],
      values[1] as any,
      values[2] as any[],
      values[3] as any
    ]);

    const formatUsage = {
      avif_referenced:
        htmlResults.some((row) => Boolean(row._has_avif_ref)) ||
        cssResults.some((row: Record<string, unknown>) => Boolean(row._has_avif_ref)),
      webp_referenced:
        htmlResults.some((row) => Boolean(row._has_webp_ref)) ||
        cssResults.some((row: Record<string, unknown>) => Boolean(row._has_webp_ref))
    };

    const cssBytesTotal = cssResults.reduce(
      (sum: number, row: Record<string, unknown>) => sum + (Number(row.css_size_bytes) || 0),
      0
    );

    for (const row of htmlResults) {
      delete row.abs;
      delete row._has_avif_ref;
      delete row._has_webp_ref;
    }
    for (const row of cssResults) {
      delete (row as Record<string, unknown>)._has_avif_ref;
      delete (row as Record<string, unknown>)._has_webp_ref;
    }

    const agg: Record<string, unknown> = {
      html_files: htmlFiles.length,
      css_files: cssFiles.length,
      html_bytes_total: htmlBytesTotal,
      css_bytes_total: cssBytesTotal,
      image_files_total: assetMetrics.image_files_total,
      image_bytes_total: assetMetrics.image_bytes_total,
      avg_image_size_bytes: assetMetrics.avg_image_size_bytes,
      font_files_total: assetMetrics.font_files_total,
      font_bytes_total: assetMetrics.font_bytes_total,
      avg_font_size_bytes: assetMetrics.avg_font_size_bytes,
      uses_avif: Boolean(assetMetrics.has_avif_files || formatUsage.avif_referenced),
      uses_webp: Boolean(assetMetrics.has_webp_files || formatUsage.webp_referenced),
      dom_nodes_avg: Number(this.avg(htmlResults, "dom_nodes").toFixed(3)),
      max_dom_depth_max: this.max(htmlResults, "max_dom_depth"),
      semantic_ratio_avg: Number(this.avg(htmlResults, "semantic_ratio").toFixed(3)),
      semantic_elements_total: this.total(htmlResults, "semantic_elements_count"),
      nonsemantic_containers_total: this.total(htmlResults, "nonsemantic_container_count"),
      heading_order_violations_total: this.total(htmlResults, "heading_order_violations"),
      img_missing_alt_total: this.total(htmlResults, "img_missing_alt"),
      img_total: this.total(htmlResults, "img_total"),
      form_controls_missing_label_total: this.total(htmlResults, "form_controls_missing_label"),
      form_controls_total: this.total(htmlResults, "form_controls_total"),
      duplicate_ids_total: this.total(htmlResults, "duplicate_ids"),
      duplicate_id_values_total: this.total(htmlResults, "duplicate_id_values"),
      rules_total: this.total(cssResults, "rules_count"),
      selectors_total: this.total(cssResults, "selectors_count"),
      avg_declarations_per_rule_avg: Number(
        this.avg(cssResults, "avg_declarations_per_rule").toFixed(3)
      ),
      max_declarations_per_rule_max: this.max(cssResults, "max_declarations_per_rule"),
      import_count_total: this.total(cssResults, "import_count"),
      avg_specificity_avg: Number(this.avg(cssResults, "avg_specificity").toFixed(3)),
      max_specificity_max: this.max(cssResults, "max_specificity"),
      complex_selectors_ratio_avg: Number(
        this.avg(cssResults, "complex_selectors_ratio").toFixed(3)
      ),
      unique_css_properties_avg: Number(
        this.avg(cssResults, "unique_css_properties_used").toFixed(3)
      ),
      dup_decl_ratio_avg: Number(this.avg(cssResults, "dup_decl_ratio").toFixed(3))
    };

    const semTotal = Number(agg.semantic_elements_total) + Number(agg.nonsemantic_containers_total);
    agg.semantic_element_usage_ratio_overall =
      semTotal > 0 ? Number((Number(agg.semantic_elements_total) / semTotal).toFixed(3)) : 0;
    agg.img_missing_alt_ratio =
      Number(agg.img_total) > 0
        ? Number((Number(agg.img_missing_alt_total) / Number(agg.img_total)).toFixed(6))
        : 0;
    agg.form_controls_missing_label_ratio =
      Number(agg.form_controls_total) > 0
        ? Number(
            (
              Number(agg.form_controls_missing_label_total) / Number(agg.form_controls_total)
            ).toFixed(6)
          )
        : 0;

    agg.vnu_files_checked = Number(vnuSummary?.files_checked) || 0;
    agg.vnu_errors_total = Number(vnuSummary?.errors_total) || 0;
    agg.vnu_warnings_total = Number(vnuSummary?.warnings_total) || 0;
    agg.vnu_unparsed_files = Number(vnuSummary?.unparsed_files) || 0;

    const allSpecificityValues = cssResults.flatMap((r: any) =>
      Array.isArray(r._specificity_values) ? r._specificity_values : []
    );
    agg.specificity_variance_overall = Number(this.variance(allSpecificityValues).toFixed(3));

    const allSelectorComplexities = cssResults.flatMap((r: any) =>
      Array.isArray(r._selector_complexities) ? r._selector_complexities : []
    );
    const totalSelectorComplexity = allSelectorComplexities.reduce(
      (a: number, b: number) => a + b,
      0
    );
    agg.total_selector_complexity_total = totalSelectorComplexity;
    agg.avg_selector_complexity_overall =
      allSelectorComplexities.length > 0
        ? Number((totalSelectorComplexity / allSelectorComplexities.length).toFixed(3))
        : 0;
    agg.max_selector_complexity_max =
      allSelectorComplexities.length > 0 ? Math.max(...allSelectorComplexities) : 0;

    const uniquePropsWork = new Set(
      cssResults.flatMap((r: any) =>
        Array.isArray(r._unique_properties) ? r._unique_properties : []
      )
    );
    agg.unique_css_properties_work = uniquePropsWork.size;

    const axeOk = auditsByHtml
      .map((x: Record<string, unknown>) => x.axe as Record<string, unknown> | undefined)
      .filter((x: Record<string, unknown> | undefined) => Boolean(x && x.enabled));
    agg.axe_violations_total = axeOk.reduce(
      (s: number, a: Record<string, unknown>) => s + (Number(a.violations_total) || 0),
      0
    );
    agg.axe_critical = axeOk.reduce(
      (s: number, a: Record<string, any>) => s + (Number(a.by_impact?.critical) || 0),
      0
    );
    agg.axe_serious = axeOk.reduce(
      (s: number, a: Record<string, any>) => s + (Number(a.by_impact?.serious) || 0),
      0
    );
    agg.axe_moderate = axeOk.reduce(
      (s: number, a: Record<string, any>) => s + (Number(a.by_impact?.moderate) || 0),
      0
    );
    agg.axe_minor = axeOk.reduce(
      (s: number, a: Record<string, any>) => s + (Number(a.by_impact?.minor) || 0),
      0
    );

    return agg;
  }

  private async hasHtmlOrCssFiles(dir: string): Promise<boolean> {
    const matches = await fg(
      ["**/*.html", "**/*.HTML", "**/*.htm", "**/*.HTM", "**/*.css", "**/*.CSS"],
      {
        cwd: dir,
        dot: false,
        onlyFiles: true,
        ignore: this.IGNORE
      }
    );
    return matches.length > 0;
  }

  private async hasDirectHtmlOrCssFiles(dir: string): Promise<boolean> {
    const matches = await fg(["*.html", "*.HTML", "*.htm", "*.HTM", "*.css", "*.CSS"], {
      cwd: dir,
      dot: false,
      onlyFiles: true,
      ignore: this.IGNORE
    });
    return matches.length > 0;
  }

  private isIgnoredDirName(name: string): boolean {
    return [
      ".git",
      ".github",
      ".vscode",
      "node_modules",
      "bootstrap",
      "images",
      "__MACOSX"
    ].includes(name);
  }

  private async collectRepoDirs(
    rootDir: string,
    recursiveMode: boolean,
    maxDepth?: number
  ): Promise<string[]> {
    if (!recursiveMode) return [rootDir];

    const normalizedMaxDepth =
      typeof maxDepth === "number" && Number.isFinite(maxDepth) && maxDepth > 0
        ? Math.trunc(maxDepth)
        : null;
    const repos = new Set<string>();

    const visit = async (dir: string, level: number): Promise<void> => {
      if (normalizedMaxDepth !== null && level >= normalizedMaxDepth) {
        return;
      }

      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (entry.name.startsWith(".") || this.isIgnoredDirName(entry.name)) {
          continue;
        }

        const absDir = path.join(dir, entry.name);
        if (await this.hasDirectHtmlOrCssFiles(absDir)) {
          repos.add(absDir);
          continue;
        }

        if (await this.hasHtmlOrCssFiles(absDir)) {
          await visit(absDir, level + 1);
        }
      }
    };

    await visit(rootDir, 0);

    if (!repos.size) {
      return (await this.hasHtmlOrCssFiles(rootDir)) ? [rootDir] : [];
    }

    return Array.from(repos).sort((a, b) => a.localeCompare(b));
  }
}
