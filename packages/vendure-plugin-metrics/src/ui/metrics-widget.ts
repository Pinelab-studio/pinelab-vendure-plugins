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
  selector: 'metrics-wdiget',
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
    {{ startDate | date }} - {{ endDate | date }}
    <br />

    <div *ngFor="let metric of metrics$ | async" class="chart-container">
      <canvas [id]="metric.id"></canvas>
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
  startDate?: Date;
  endDate?: Date;
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
    this.metrics$ = this.dataService
      .query<MetricListQuery, MetricListQueryVariables>(GET_METRICS, {
        input: {
          interval: this.selection,
          endDate: new Date().toISOString(),
        },
      })
      .mapStream((list) => {
        this.startDate = list.metricList.startDate;
        this.endDate = list.metricList.endDate;
        return list.metricList.metrics;
      });
    this.metrics$.subscribe(async (metrics) => {
      this.charts.forEach((chart) => chart.destroy());
      await new Promise((resolve) => setTimeout(resolve, 500));
      metrics.forEach((chartData) =>
        this.charts.push(this.createChart(chartData))
      );
    });
  }

  selectTimeFrame(select: string) {
    this.selection = select as MetricInterval;
    // TODO: refetch data
  }

  createChart(metric: Metric) {
    const h = 196; // Vendure hue
    const s = 100;
    const l = Math.floor(Math.random() * (80 - 20 + 1)) + 20;
    const color = h + ', ' + s + '%, ' + l + '%';
    return new Chart(metric.id, {
      type: 'bar',
      data: {
        // values on X-Axis
        labels: metric.data.map((d) => d.label),
        datasets: [
          {
            label: metric.title,
            data: metric.data.map((d) => d.value),
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
