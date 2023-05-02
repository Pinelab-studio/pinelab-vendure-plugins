import { Component, OnInit } from '@angular/core';
import { DataService } from '@vendure/admin-ui/core';
import { MetricInterval, MetricSummary } from './generated/graphql';
import Chart from 'chart.js/auto';
import { BehaviorSubject, Observable } from 'rxjs';
import { MetircsUiService } from './metrics-ui.service';

@Component({
  selector: 'order-metrics-widget',
  template: `
    <div
      class="btn-group btn-outline-primary btn-sm"
      *ngIf="selection$ | async as selection"
    >
      <button
        class="btn"
        [class.btn-primary]="selection === 'WEEKLY'"
        (click)="selection$.next('WEEKLY')"
      >
        Weekly
      </button>
      <button
        class="btn"
        [class.btn-primary]="selection === 'MONTHLY'"
        (click)="selection$.next('MONTHLY')"
      >
        Monthly
      </button>
    </div>
    <br />

    <div *ngFor="let metric of metrics$ | async" class="chart-container">
      <canvas id="{{ metric.code }}-{{ widgetId }}"></canvas>
    </div>
  `,
  styles: [
    '.chart-container { height: 200px; width: 33%; padding-right: 20px; display: inline-block; padding-top: 20px;}',
    '@media screen and (max-width: 768px) { .chart-container { width: 100%; } }',
  ],
})
export class OrderMetricsWidgetComponent implements OnInit {
  metrics$: Observable<MetricSummary[]> | undefined;
  charts: any[] = [];
  selection: MetricInterval = MetricInterval.Monthly;
  selection$ = new BehaviorSubject<MetricInterval>(MetricInterval.Monthly);
  widgetId = 'order-metrics';
  nrOfOrdersChart?: any;

  constructor(
    private dataService: DataService,
    private metricsService: MetircsUiService
  ) {}

  async ngOnInit() {
    this.metrics$ = this.metricsService.queryData(this.selection$);
    this.metrics$.subscribe(async (metrics) => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for Angular redraw
      this.charts.forEach((chart) => chart.destroy());
      metrics.forEach((chartData) =>
        this.charts.push(this.createChart(chartData))
      );
    });
  }

  createChart(metric: MetricSummary) {
    return this.metricsService.createChart(metric, this.widgetId);
  }
}
