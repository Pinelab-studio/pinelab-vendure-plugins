import { Injectable } from '@angular/core';
import { DataService, ChartFormatOptions } from '@vendure/admin-ui/core';
import { AdvancedMetricSummary, AdvancedMetricType } from './generated/graphql';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { GET_METRICS } from './queries.graphql';
import { switchMap } from 'rxjs/operators';
import { ChartEntry } from './chartist/chartist.component';
export interface AdvancedChartEntry {
  label: string;
  value: number;
  formatOptions: ChartFormatOptions;
  code: string;
  name: string;
}
@Injectable({
  providedIn: 'root',
})
export class MetricsUiService {
  currencyCode$: Observable<any>;
  uiState$: Observable<any>;
  constructor(private dataService: DataService) {
    this.currencyCode$ = this.dataService.settings
      .getActiveChannel()
      .refetchOnChannelChange()
      .mapStream((data) => data.activeChannel.defaultCurrencyCode || undefined);
    this.uiState$ = this.dataService.client
      .uiState()
      .mapStream((data) => data.uiState);
  }

  queryData(selectedVariantIds?: string[]) {
    return combineLatest(this.currencyCode$, this.uiState$).pipe(
      switchMap(([currencyCode, uiState]) =>
        this.dataService
          .query(GET_METRICS, {
            input: {
              ...(selectedVariantIds ? { variantIds: selectedVariantIds } : []),
            },
          })
          .refetchOnChannelChange()
          .mapStream((metricSummary: any) => {
            return this.toChartEntry(
              metricSummary.advancedMetricSummaries,
              `${uiState.language}-${uiState.locale}`,
              currencyCode,
            );
          }),
      ),
    );
  }

  toChartEntry(
    input: AdvancedMetricSummary[],
    locale: string,
    currencyCode: string,
  ): ChartEntry[] {
    return input.map((r) => {
      const formatValueAs: 'currency' | 'number' =
        r.type === AdvancedMetricType.Number ? 'number' : 'currency';
      const formatOptions: ChartFormatOptions = {
        formatValueAs,
        currencyCode,
        locale,
      };
      return {
        formatOptions,
        summary: r,
      };
    });
  }
}
