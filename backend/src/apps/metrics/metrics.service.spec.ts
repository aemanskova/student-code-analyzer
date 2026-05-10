import { MetricsService } from "./metrics.service";
import { DirectionMetricProvider } from "./metrics.types";

const createProvider = (
  direction: string,
  supportedMetrics: string[],
  values: Record<string, number | string | boolean | null> = {}
): DirectionMetricProvider => ({
  direction,
  supportedMetrics,
  computeSelected: jest.fn().mockResolvedValue(values)
});

describe("MetricsService", () => {
  it("returns supported directions and metrics from registered providers", () => {
    const htmlCssProvider = createProvider("html_css", ["tag_count"]);
    const jsProvider = createProvider("js", ["lines_of_code"]);
    const tsProvider = createProvider("typescript", ["LOC"]);
    const vueProvider = createProvider("vue", ["TS_ANY_VUE"]);
    const service = new MetricsService(
      htmlCssProvider as never,
      jsProvider as never,
      tsProvider as never,
      vueProvider as never
    );

    expect(service.getSupportedDirections()).toEqual(["html_css", "js", "typescript", "vue"]);
    expect(service.getSupportedMetrics("js")).toEqual(["lines_of_code"]);
    expect(service.getSupportedMetrics("unknown")).toEqual([]);
  });

  it("delegates selected metric computation to the direction provider", async () => {
    const htmlCssProvider = createProvider("html_css", ["tag_count"], { tag_count: 3 });
    const jsProvider = createProvider("js", ["lines_of_code"]);
    const tsProvider = createProvider("typescript", ["LOC"]);
    const vueProvider = createProvider("vue", ["TS_ANY_VUE"]);
    const service = new MetricsService(
      htmlCssProvider as never,
      jsProvider as never,
      tsProvider as never,
      vueProvider as never
    );

    await expect(
      service.compute("html_css", { absolutePath: "/tmp/index.html", relativePath: "index.html" }, [
        "tag_count"
      ])
    ).resolves.toEqual({ tag_count: 3 });
    expect(htmlCssProvider.computeSelected).toHaveBeenCalledWith(
      { absolutePath: "/tmp/index.html", relativePath: "index.html" },
      ["tag_count"]
    );
  });

  it("rejects unsupported directions and metrics", async () => {
    const htmlCssProvider = createProvider("html_css", ["tag_count"]);
    const service = new MetricsService(
      htmlCssProvider as never,
      createProvider("js", []) as never,
      createProvider("typescript", []) as never,
      createProvider("vue", []) as never
    );

    await expect(
      service.compute("python", { absolutePath: "/tmp/a.py", relativePath: "a.py" }, [])
    ).rejects.toThrow("Unsupported direction: python");
    await expect(
      service.compute("html_css", { absolutePath: "/tmp/index.html", relativePath: "index.html" }, [
        "unknown_metric"
      ])
    ).rejects.toThrow("Unsupported metrics for html_css: unknown_metric");
  });
});
