import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  DataService,
  ModalService,
  ProductMultiSelectorDialogComponent,
  // ChartEntry
} from '@vendure/admin-ui/core';
import { AdvancedMetricInterval } from './generated/graphql';
import { BehaviorSubject, Observable } from 'rxjs';
import { AdvancedChartEntry, MetricsUiService } from './metrics-ui.service';

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
      <small *ngIf="selectedVariantNames.length">
        {{ selectedVariantNames.join(' + ') }}
      </small>
    </div>
    <vdr-chart [entries]="selectedMetrics" />
    <div class="flex">
      <button
        *ngFor="let metric of metrics$ | async"
        class="button-small"
        (click)="selectedMetrics = metric"
        [class.active]="selectedMetrics[0].code === metric[0].code"
      >
        {{ metric[0].code }}
      </button>
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
        margin-left: 10.55px !important;
        margin-right: 10.55px !important;
        margin-bottom: 5px !important;
        padding-top: 7.5px !important;
        position: relative;
        top: 4px;
      }
    `,
    `
      clr-icon[shape='times'] {
        margin-top: -7.75px !important;
        margin-left: 0.2px !important;
      }
    `,
    `
      .button-small.active {
        background-color: var(--color-primary-200);
        color: var(--color-primary-900);
      }
    `,
    `
      .flex {
        gap: 0.5rem;
      }
    `,
  ],
})
export class MetricsWidgetComponent implements OnInit {
  metrics$: Observable<AdvancedChartEntry[][]> | undefined;
  selectedMetrics: AdvancedChartEntry[] | undefined;
  variantName: string;
  dropDownName = 'Select Variant';
  selection: AdvancedMetricInterval = AdvancedMetricInterval.Monthly;
  selection$ = new BehaviorSubject<AdvancedMetricInterval>(
    AdvancedMetricInterval.Monthly
  );
  nrOfOrdersChart?: any;
  selectedVariantIds: string[] = [];
  selectedVariantNames: string[] = [];

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
          this.selectedVariantNames = selection.map(
            (s) => s.productVariantName
          );
          (this.selectedVariantIds = selection.map((s) => s.productVariantId)),
            this.changeDetectorRef.detectChanges();
          this.loadChartData();
        }
      });
  }

  clearProductVariantSelection() {
    this.selectedVariantIds = [];
    this.selectedVariantNames = [];
    this.changeDetectorRef.detectChanges();
    this.loadChartData();
  }

  loadChartData() {
    this.metrics$ = this.metricsService.queryData(
      this.selection$,
      this.selectedVariantIds
    );
    this.changeDetectorRef.detectChanges();
    this.metrics$.subscribe(async (metrics) => {
      if (this.selectedMetrics?.length) {
        this.selectedMetrics = metrics.find(
          (e) => e[0].code == this.selectedMetrics![0].code
        );
      } else {
        this.selectedMetrics = metrics[0];
      }
      this.changeDetectorRef.detectChanges();
    });
  }
}
