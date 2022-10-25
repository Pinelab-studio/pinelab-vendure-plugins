import { Component, NgModule, OnInit } from '@angular/core';
import { DataService, SharedModule } from '@vendure/admin-ui/core';
import {
  MetricInterval,
  MetricListQuery,
  MetricListQueryVariables,
} from './generated/graphql';
import Chart from 'chart.js/auto';
import { GET_METRICS } from './queries.graphql';
import { Observable } from 'rxjs';

type Metric = MetricListQuery['metricList']['metrics'][0];

@Component({
  selector: 'metrics-widget',
  template: `
    <div class="btn-group btn-outline-primary btn-sm">
      <button
        class="btn"
        [class.btn-primary]="selection === 'WEEKLY'"
        (click)="selectTimeFrame('WEEKLY')"
      >
        Weekly
      </button>
      <button
        class="btn"
        [class.btn-primary]="selection === 'MONTHLY'"
        (click)="selectTimeFrame('MONTHLY')"
      >
        Monthly
      </button>
    </div>
    <br />

    <div *ngFor="let metric of metrics$ | async" class="chart-container">
      <canvas [id]="metric.code"></canvas>
    </div>
  `,
  styles: [
    '.chart-container { height: 200px; width: 33%; padding-right: 20px; display: inline-block; padding-top: 20px;}',
    '@media screen and (max-width: 768px) { .chart-container { width: 100%; } }',
  ],
})
export class MetricsWidgetComponent implements OnInit {
  metrics$: Observable<Metric[]> | undefined;
  charts: any[] = [];
  selection: MetricInterval = MetricInterval.Monthly;
  nrOfOrdersChart?: any;
  // Config for all charts
  config = {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      ticks: {
        display: false,
      },
      grid: {
        display: false,
        drawBorder: false,
      },
    },
  };

  constructor(private dataService: DataService) {}

  async ngOnInit() {
    this.observe();
  }

  selectTimeFrame(select: string) {
    this.selection = select as MetricInterval;
    this.observe();
  }

  observe() {
    this.metrics$ = this.dataService
      .query<MetricListQuery, MetricListQueryVariables>(GET_METRICS, {
        input: {
          interval: this.selection,
        },
      })
      .mapStream((list) => {
        return list.metricList.metrics;
      });
    this.metrics$.subscribe(async (metrics) => {
      this.charts.forEach((chart) => chart.destroy());
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for Angular redraw
      metrics.forEach((chartData) =>
        this.charts.push(this.createChart(chartData))
      );
    });
  }

  createChart(metric: Metric) {
    const h = 196; // Vendure hue
    const s = 100;
    const l = Math.floor(Math.random() * (80 - 20 + 1)) + 20;
    const color = h + ', ' + s + '%, ' + l + '%';
    return new Chart(metric.code, {
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

@NgModule({
  imports: [SharedModule],
  declarations: [MetricsWidgetComponent],
})
export class MetricsWidgetModule {}
