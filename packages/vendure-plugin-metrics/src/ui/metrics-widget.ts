import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  ModalService,
  ProductMultiSelectorDialogComponent,
} from '@vendure/admin-ui/core';
// import { AdvancedMetricInterval } from './generated/graphql';
import { Observable } from 'rxjs';
import { ChartEntry } from './chartist/chartist.component';
import { MetricsUiService } from './metrics-ui.service';

@Component({
  selector: 'product-metrics-widget',
  template: `
    <div style="position: relative;">
      <div>
        <div *ngIf="loading" class="spinner-overlay">
          <div class="spinner">Loading...</div>
        </div>

        <button
          [disabled]="!selectedMetric?.summary.allowProductSelection"
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
      <br />
      <br />
      <vdr-chartist [entries]="selectedMetric" style="padding-left: 50px; " />
      <br />
      <br />
      <div class="flex">
        <button
          *ngFor="let metric of metrics$ | async"
          class="button-small"
          (click)="selectedMetric = metric"
          [class.active]="selectedMetric?.summary.code === metric.summary.code"
        >
          {{ metric.summary.title }}
        </button>
      </div>
    </div>
  `,
  styles: [
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
    `
      .spinner-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99;
      }
    `,
  ],
})
export class MetricsWidgetComponent implements OnInit {
  metrics$: Observable<ChartEntry[]> | undefined;
  selectedMetric: ChartEntry | undefined;
  dropDownName = 'Select Variant';
  nrOfOrdersChart?: any;
  selectedVariantIds: string[] = [];
  selectedVariantNames: string[] = [];
  loading = true;

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private modalService: ModalService,
    private metricsService: MetricsUiService
  ) {}

  async ngOnInit() {
    this.loadChartData();
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
          this.selectedVariantIds = selection.map((s) => s.productVariantId);
          this.metricsService.selectedVariantIds$.next(this.selectedVariantIds);
          this.changeDetectorRef.detectChanges();
        }
      });
  }

  clearProductVariantSelection() {
    this.selectedVariantIds = [];
    this.metricsService.selectedVariantIds$.next(this.selectedVariantIds);
    this.selectedVariantNames = [];
    this.changeDetectorRef.detectChanges();
  }

  loadChartData() {
    this.loading = true;
    this.metrics$ = this.metricsService.queryData$;
    this.changeDetectorRef.detectChanges();
    this.metrics$?.subscribe(async (metrics) => {
      this.loading = false;
      if (this.selectedMetric) {
        this.selectedMetric = metrics.find(
          (e) => e.summary.code == this.selectedMetric?.summary.code
        );
      } else {
        this.selectedMetric = metrics[0];
      }
      this.changeDetectorRef.detectChanges();
    });
  }
}
