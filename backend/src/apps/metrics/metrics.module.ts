import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { HtmlCssMetricProvider } from './html-css/html-css-metric.provider';

@Module({
  providers: [MetricsService, HtmlCssMetricProvider],
  exports: [MetricsService],
})
export class MetricsModule {}
