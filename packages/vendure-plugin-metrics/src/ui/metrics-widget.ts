import { Component, NgModule, OnInit, AfterViewInit } from '@angular/core';
import { SharedModule } from '@vendure/admin-ui/core';
import Chart from 'chart.js/auto';
import { chartDatas } from './data';

@Component({
  selector: 'metrics-wdiget',
  template: `
    <div class="btn-group btn-outline-primary btn-sm">
      <button
        class="btn"
        [class.btn-primary]="selection === 'weekly'"
        (click)="selectTimeFrame('weekly')"
      >
        Weekly
      </button>
      <button
        class="btn"
        [class.btn-primary]="selection === 'monthly'"
        (click)="selectTimeFrame('monthly')"
      >
        Monthly
      </button>
    </div>
    <br />

    <div *ngFor="let id of chartIds" class="chart-container">
      <canvas [id]="id"></canvas>
    </div>
  `,
  styles: [
    '.chart-container { height: 200px; width: 33%; padding-right: 20px; display: inline-block; padding-top: 20px;}',
    '@media screen and (max-width: 768px) { .chart-container { width: 100%; } }',
  ],
})
export class MetricsWidgetComponent implements OnInit, AfterViewInit {
  chartIds: string[] = [];
  charts: any[] = [];
  selection: 'monthly' | 'weekly' = 'monthly';
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

  constructor() {}

  async ngOnInit() {
    this.chartIds = chartDatas.map((d) => d.id);
    //await new Promise(resolve => setTimeout(resolve, 500)); // Wait for canvasses tp be drawn so Chart.js can find them
  }

  ngAfterViewInit() {
    chartDatas.forEach((chartData) =>
      this.charts.push(this.createChart(chartData))
    );
  }

  selectTimeFrame(select: 'monthly' | 'weekly') {
    this.selection = select;
    this.charts.forEach((chart) => chart.destroy());
    chartDatas.forEach((chartData) =>
      this.charts.push(this.createChart(chartData))
    );
  }

  createChart(data: typeof chartDatas[0]) {
    const h = 196; // Vendure hue
    const [min, max] = [20, 80];
    const s = 100;
    const l = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Chart(data.id, {
      type: 'bar',
      data: {
        // values on X-Axis
        labels: data.dataset.map((d) => d.label),
        datasets: [
          {
            label: data.title,
            data: data.dataset.map((d) => d.data),
            backgroundColor: 'hsla(' + h + ', ' + s + '%, ' + l + '%, 0.4)',
            borderColor: 'hsl(' + h + ', ' + s + '%, ' + l + '%)',
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
