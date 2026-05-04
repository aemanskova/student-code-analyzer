import { Injectable } from "@nestjs/common";
import { DirectionMetricProvider, MetricComputeContext, MetricValues } from "./metrics.types";
import { HtmlCssMetricProvider } from "./html-css/html-css-metric.provider";
import { JsMetricProvider } from "./js/js-metric.provider";

@Injectable()
export class MetricsService {
  private readonly providers = new Map<string, DirectionMetricProvider>();

  constructor(htmlCssProvider: HtmlCssMetricProvider, jsProvider: JsMetricProvider) {
    this.providers.set(htmlCssProvider.direction, htmlCssProvider);
    this.providers.set(jsProvider.direction, jsProvider);
  }

  getSupportedDirections() {
    return Array.from(this.providers.keys());
  }

  getSupportedMetrics(direction: string) {
    const provider = this.providers.get(direction);
    return provider ? provider.supportedMetrics : [];
  }

  async compute(
    direction: string,
    context: MetricComputeContext,
    metrics: string[]
  ): Promise<MetricValues> {
    const provider = this.providers.get(direction);
    if (!provider) {
      throw new Error(`Unsupported direction: ${direction}`);
    }

    const unsupported = metrics.filter((metric) => !provider.supportedMetrics.includes(metric));
    if (unsupported.length > 0) {
      throw new Error(`Unsupported metrics for ${direction}: ${unsupported.join(", ")}`);
    }

    return provider.computeSelected(context, metrics);
  }
}
