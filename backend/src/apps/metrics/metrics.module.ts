import { Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { HtmlCssMetricProvider } from "./html-css/html-css-metric.provider";
import { JsMetricProvider } from "./js/js-metric.provider";

@Module({
  providers: [MetricsService, HtmlCssMetricProvider, JsMetricProvider],
  exports: [MetricsService]
})
export class MetricsModule {}
