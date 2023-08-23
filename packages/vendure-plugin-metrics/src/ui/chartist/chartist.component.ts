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
import { LineChart, LineChartData, LineChartOptions } from 'chartist';
import ChartistTooltip from 'chartist-plugin-tooltips-updated';
import { legend } from './legend';
import { AdvancedMetricSummary } from '../generated/graphql';
export interface ChartFormatOptions {
  formatValueAs: 'currency' | 'number';
  currencyCode?: string;
  locale?: string;
}

export interface ChartEntry {
  label: string;
  value: number;
  formatOptions: ChartFormatOptions;
  name: string;
}

@Component({
  selector: 'vdr-chartist',
  templateUrl: './chartist.component.html',
  styleUrls: ['./chartist.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartistComponent implements OnInit, OnChanges, OnDestroy {
  @Input() entries: AdvancedMetricSummary[] = [];
  @Input() options?: LineChartOptions = {};
  @ViewChild('chartistDiv', { static: true })
  private chartDivRef: ElementRef<HTMLDivElement>;
  private chart: LineChart;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.chart = new LineChart(
      this.chartDivRef.nativeElement,
      this.entriesToLineChartData(this.entries ?? []),
      {
        low: 0,
        // showArea: true,
        showLine: true,
        showPoint: true,
        fullWidth: true,
        plugins: [ChartistTooltip(), legend()],
        ...this.options,
      }
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('entries' in changes && this.chart) {
      this.chart.update(this.entriesToLineChartData(this.entries ?? []));
    }
  }

  ngOnDestroy() {
    this.chart?.detach();
  }

  private entriesToLineChartData(lines: ChartEntry[][]): LineChartData {
    if (lines.length) {
      const labels = lines[0].map(({ label }) => label);
      //new CurrencyPipe(e.formatOptions.locale??'en_US',e.formatOptions.currencyCode).transform(e.value,e.formatOptions.currencyCode)
      const series = lines.map((entry) => {
        return entry.map((e, index) => ({
          meta: labels[index],
          legend: e.name,
          value: e.value,
        }));
      });
      this.cdr.detectChanges();
      return { labels, series };
    }
    return { labels: [], series: [] };
  }
}
