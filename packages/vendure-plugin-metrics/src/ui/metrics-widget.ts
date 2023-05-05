import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  DataService,
  ModalService,
  ProductMultiSelectorDialogComponent,
} from '@vendure/admin-ui/core';
import { MetricInterval, MetricSummary } from './generated/graphql';
import { BehaviorSubject, Observable } from 'rxjs';
import { MetricsUiService } from './metrics-ui.service';

@Component({
  selector: 'product-metrics-widget',
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
      <button
        (click)="openProductSelectionDialog()"
        class="btn btn-sm btn-secondary"
      >
        {{
          'common.items-selected-count'
            | translate : { count: selectedVariantIds?.length ?? 0 }
        }}...
      </button>
      <button
        class="btn btn-sm circular-button"
        [attr.disabled]="selectedVariantIds.length == 0 ? 'disabled' : null"
        (click)="clearProductVariantSelection()"
      >
        <clr-icon shape="times"></clr-icon>
      </button>
    </div>
    <div *ngFor="let metric of metrics$ | async" class="chart-container">
      <canvas id="{{ metric.code }}-{{ widgetId }}"></canvas>
    </div>
  `,
  styles: [
    '.chart-container { height: 200px; width: 33%; padding-right: 20px; display: inline-block; padding-top: 20px;}',
    '@media screen and (max-width: 768px) { .chart-container { width: 100%; } }',
    `
      .circular-button {
        width: 16px !important;
        min-width: 16px !important;
        height: 16px !important;
        min-height: 16px !important;
        border-radius: 50% !important;
        padding: 0px 0px !important;
        margin-left: 2.55px !important;
        margin-bottom: 5px !important;
        margin-top: 4.25px;
      }
    `,
    `
      clr-icon[shape='times'] {
        margin-top: -7.75px !important;
        margin-left: 0.2px !important;
      }
    `,
  ],
})
export class MetricsWidgetComponent implements OnInit {
  metrics$: Observable<MetricSummary[]> | undefined;
  charts: any[] = [];
  variantName: string;
  dropDownName = 'Select Variant';
  widgetId = 'product-metrics';
  selection: MetricInterval = MetricInterval.Monthly;
  selection$ = new BehaviorSubject<MetricInterval>(MetricInterval.Monthly);
  nrOfOrdersChart?: any;
  selectedVariantIds: string[] = [];

  constructor(
    private dataService: DataService,
    private changeDetectorRef: ChangeDetectorRef,
    private modalService: ModalService,
    private metricsService: MetricsUiService
  ) {}

  async ngOnInit() {
    this.loadChartData();
  }

  onDropdownItemClick(variantId: string, variantName: string) {
    this.loadChartData();
    this.dropDownName = variantName;
  }

  openProductSelectionDialog() {
    this.modalService
      .fromComponent(ProductMultiSelectorDialogComponent, {
        size: 'xl',
        locals: {
          mode: 'variant',

          initialSelectionIds: this.selectedVariantIds ?? [],
        },
      })
      .subscribe((selection) => {
        if (selection) {
          this.selectedVariantIds = [
            ...selection.map((s) => s.productVariantId),
          ];
          this.changeDetectorRef.detectChanges();
          this.loadChartData();
        }
      });
  }

  clearProductVariantSelection() {
    this.selectedVariantIds = [];
    this.changeDetectorRef.detectChanges();
    this.loadChartData();
  }

  loadChartData() {
    this.metrics$ = this.metricsService.queryData(
      this.selection$,
      this.selectedVariantIds
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
    return this.metricsService.createChart(metric, this.widgetId);
  }
}
