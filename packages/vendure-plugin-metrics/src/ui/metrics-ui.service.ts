import { Injectable } from '@angular/core';
import { DataService, ChartFormatOptions } from '@vendure/admin-ui/core';
import {
  AdvancedMetricInterval,
  AdvancedMetricSummary,
  AdvancedMetricSummaryQuery,
  AdvancedMetricSummaryQueryVariables,
  AdvancedMetricType,
} from './generated/graphql';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { GET_METRICS } from './queries.graphql';
import { switchMap } from 'rxjs/operators';
export interface AdvancedChartEntry {
  label: string;
  value: number;
  formatOptions: ChartFormatOptions;
  code: string;
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

  queryData(
    selection$: BehaviorSubject<AdvancedMetricInterval>,
    selectedVariantIds?: string[]
  ) {
    return combineLatest(selection$, this.currencyCode$, this.uiState$).pipe(
      switchMap(([selection, currencyCode, uiState]) =>
        this.dataService
          .query<
            AdvancedMetricSummaryQuery,
            AdvancedMetricSummaryQueryVariables
          >(GET_METRICS, {
            input: {
              interval: selection,
              ...(selectedVariantIds ? { variantIds: selectedVariantIds } : []),
            },
          })
          .refetchOnChannelChange()
          .mapStream((metricSummary) => {
            return this.toChartEntry(
              metricSummary.advancedMetricSummary,
              `${uiState.language}-${uiState.locale}`,
              currencyCode
            );
          })
      )
    );
  }

  toChartEntry(
    input: AdvancedMetricSummary[],
    locale: string,
    currencyCode: string
  ): AdvancedChartEntry[][] {
    return input.map((r) => {
      const formatValueAs: 'currency' | 'number' =
        r.type === AdvancedMetricType.Number ? 'number' : 'currency';
      const formatOptions: ChartFormatOptions = {
        formatValueAs,
        currencyCode,
        locale,
      };
      return r.entries.map((e) => {
        return {
          code: r.code,
          formatOptions,
          ...e,
        };
      });
    });
  }
}
