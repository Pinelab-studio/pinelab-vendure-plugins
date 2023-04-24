import { Component, NgModule, OnInit } from '@angular/core';
import { DataService, SharedModule } from '@vendure/admin-ui/core';
import {
  MetricInterval,
  MetricSummary,
  MetricSummaryQuery,
  MetricSummaryQueryVariables,
} from './generated/graphql';
import Chart from 'chart.js/auto';
import { GET_METRICS, ITEMS } from './queries.graphql';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'metrics-widget',
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
    <br />
    <div>
      <clr-dropdown>
        <button class="btn btn-outline-primary" clrDropdownTrigger>
          <cds-icon shape="angle" direction="down"></cds-icon>
          {{ dropDownName }}
        </button>
        <clr-dropdown-menu clrPosition="right-bottom" *clrIfOpen>
          <clr-dropdown *ngFor="let product of items$ | async">
            <button clrDropdownTrigger>{{ product.name }}</button>
            <clr-dropdown-menu clrPosition="right-top" *clrIfOpen>
              <button
                *ngFor="let variant of product.variants"
                clrDropdownItem
                (click)="onItemClick(variant.id, variant.name)"
              >
                {{ variant.name }}
              </button>
            </clr-dropdown-menu>
          </clr-dropdown>
        </clr-dropdown-menu>
      </clr-dropdown>
    </div>
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
  metrics$: Observable<MetricSummary[]> | undefined;
  charts: any[] = [];
  variantName: string;
  dropDownName = 'Select Variant';
  selection: MetricInterval = MetricInterval.Monthly;
  selection$ = new BehaviorSubject<MetricInterval>(MetricInterval.Monthly);
  items$: Observable<any>;
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
        display: true,
      },
      grid: {
        display: false,
        drawBorder: false,
      },
    },
  };

  constructor(private dataService: DataService) {}

  async ngOnInit() {
    //this.observe();
    this.loadChartData();
    this.items$ = this.dataService
      .query(ITEMS)
      .mapSingle((productList) => (productList as any).products.items);
  }

  onItemClick(variantId: string, variantName: string) {
    this.loadChartData(variantId);
    this.dropDownName = variantName;
  }

  loadChartData(variantId?: string) {
    this.metrics$ = this.selection$.pipe(
      switchMap((selection) => {
        return this.dataService
          .query<MetricSummaryQuery, MetricSummaryQueryVariables>(GET_METRICS, {
            input: {
              interval: selection,
              variantId,
            },
          })
          .refetchOnChannelChange()
          .mapStream((metricSummary) => {
            return metricSummary.metricSummary;
          });
      })
    );
    this.metrics$.subscribe(async (metrics) => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for Angular redraw
      this.charts.forEach((chart) => chart.destroy());
      metrics.forEach((chartData) =>
        this.charts.push(this.createChart(chartData))
      );
    });
  }

  createChart(metric: MetricSummary) {
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
