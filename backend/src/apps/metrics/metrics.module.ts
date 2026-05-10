import { Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { HtmlCssMetricProvider } from "./html-css/html-css-metric.provider";
import { JsMetricProvider } from "./js/js-metric.provider";
import { TypeScriptMetricProvider } from "./typescript/typescript-metric.provider";

@Module({
  providers: [MetricsService, HtmlCssMetricProvider, JsMetricProvider, TypeScriptMetricProvider],
  exports: [MetricsService]
})
export class MetricsModule {}
