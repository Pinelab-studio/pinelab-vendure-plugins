import { Injectable } from '@angular/core';
import { DataService } from '@vendure/admin-ui/core';
import {
  MetricInterval,
  MetricSummary,
  MetricSummaryQuery,
  MetricSummaryQueryVariables,
} from './generated/graphql';
import { BehaviorSubject } from 'rxjs';
import { GET_METRICS } from './queries.graphql';
import { switchMap } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
@Injectable({
  providedIn: 'root',
})
export class MetricsUiService {
  config = {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      ticks: {
        display: true,
      },
      grid: {
        display: false,
        drawBorder: false,
      },
    },
  };
  constructor(private dataService: DataService) {
    Chart.register(...registerables);
  }

  queryData(
    selection$: BehaviorSubject<MetricInterval>,
    selectedVariantIds?: string[]
  ) {
    return selection$.pipe(
      switchMap((selection) => {
        return this.dataService
          .query<MetricSummaryQuery, MetricSummaryQueryVariables>(GET_METRICS, {
            input: {
              interval: selection,
              ...(selectedVariantIds ? { variantIds: selectedVariantIds } : []),
            },
          })
          .refetchOnChannelChange()
          .mapStream((metricSummary) => {
            return metricSummary.metricSummary;
          });
      })
    );
  }

  createChart(metric: MetricSummary, widgetId: string) {
    const h = 196; // Vendure hue
    const s = 100;
    const l = Math.floor(Math.random() * (80 - 20 + 1)) + 20;
    const color = h + ', ' + s + '%, ' + l + '%';
    return new Chart(`${metric.code}-${widgetId}`, {
      type: 'bar',
      data: {
        // values on X-Axis
        labels: metric.entries.map((e) => e.label),
        datasets: [
          {
            label: metric.title,
            data: metric.entries.map((e) => e.value),
            backgroundColor: `hsla(${color}, 0.4)`,
            borderColor: `hsla(${color})`,
            borderWidth: 1,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: this.config,
      },
    });
  }
}
