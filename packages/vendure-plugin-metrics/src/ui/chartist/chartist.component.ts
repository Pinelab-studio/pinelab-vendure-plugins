import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LineChart, LineChartData, LineChartOptions, easings } from 'chartist';
import ChartistTooltip from 'chartist-plugin-tooltips-updated';
import { legend } from './legend';
import { AdvancedMetricSummary } from '../generated/graphql';
export interface ChartFormatOptions {
  formatValueAs: 'currency' | 'number';
  currencyCode?: string;
  locale?: string;
}

export interface ChartEntry {
  summary: AdvancedMetricSummary;
  formatOptions: ChartFormatOptions;
}

@Component({
  selector: 'vdr-chartist',
  templateUrl: './chartist.component.html',
  styleUrls: ['./chartist.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartistComponent implements OnInit, OnChanges, OnDestroy {
  @Input() entries: ChartEntry | undefined;
  @Input() options?: LineChartOptions = {};
  @ViewChild('chartistDiv', { static: true })
  private chartDivRef: ElementRef<HTMLDivElement>;
  private chart: LineChart;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.chart = new LineChart(
      this.chartDivRef.nativeElement,
      this.entriesToLineChartData(this.entries),
      {
        low: 0,
        // showArea: true,
        showLine: true,
        showPoint: true,
        fullWidth: true,
        axisY: {
          labelInterpolationFnc: (value: number, _: number) => {
            return this.formatCurrencyToValue(value);
          },
        },
        plugins: [
          ChartistTooltip({
            currency: '$',
            currencyFormatCallback: (value: number, _: any) => {
              return this.formatCurrencyToValue(value);
            },
          }),
          legend(),
        ],
        ...this.options,
      }
    );

    this.chart.on('draw', (data) => {
      if (data.type === 'line' || data.type === 'area') {
        data.element.animate({
          d: {
            begin: 2000 * data.index,
            dur: 2000,
            from: data.path
              .clone()
              .scale(1, 0)
              .translate(0, data.chartRect.height())
              .stringify(),
            to: data.path.clone().stringify(),
            easing: easings.easeOutQuint,
          },
        });
      }
    });
  }

  formatCurrencyToValue(value: number) {
    // Grab a local copy so typescript tracks the truthy check correctly
    const entries = this.entries;
    if (entries) {
      const localeFrom =
        localStorage.getItem('vnd__contentLanguageCode') ?? 'en';
      const formatter = new CurrencyPipe(
        entries.formatOptions.locale ?? localeFrom,
        entries.formatOptions.currencyCode
      );
      const format = (l: number) =>
        entries.formatOptions.formatValueAs === 'currency'
          ? formatter.transform(l) ?? l
          : l;
      return format(value);
    }
    return value;
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('entries' in changes && this.chart) {
      this.chart.update(this.entriesToLineChartData(this.entries));
    }
  }

  ngOnDestroy() {
    this.chart?.detach();
  }

  private entriesToLineChartData(entry: ChartEntry | undefined): LineChartData {
    if (entry?.summary.labels?.length) {
      const labels = entry.summary.labels;
      const series = entry.summary.series.map((s) => {
        return s.values.map((v) => {
          return {
            legend: s.name,
            value: v,
          };
        });
      });
      this.cdr.detectChanges();
      return { labels, series };
    }
    return { labels: [], series: [] };
  }
}
