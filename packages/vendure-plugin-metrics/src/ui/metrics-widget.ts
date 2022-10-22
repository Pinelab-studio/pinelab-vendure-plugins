import { Component, NgModule, OnInit } from '@angular/core';
import { SharedModule } from '@vendure/admin-ui/core';
import Chart from 'chart.js/auto';
import { nrOfOrders } from './data';

@Component({
  selector: 'metrics-wdiget',
  template: `
    <div class="chart-container">
      <canvas id="nrOfOrders"></canvas>
    </div>
    <div class="chart-container">
      <canvas id="conversion"></canvas>
    </div>
    <div class="chart-container">
      <canvas id="aov"></canvas>
    </div>
  `,
  styles: [
    '.chart-container { height: 200px; width: 33%; padding-right: 20px; display: inline-block; }',
  ],
})
export class MetricsWidgetComponent implements OnInit {
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

  ngOnInit() {
    this.createChart('nrOfOrders', 'Nr of placed orders', nrOfOrders);
    this.createChart('aov', 'Average order value €', nrOfOrders);
    this.createChart('conversion', 'Conversion rate %', nrOfOrders);
  }

  createChart(id: string, title: string, data: typeof nrOfOrders) {
    const h = 196; // Vendure hue
    const [min, max] = [20, 80];
    const s = 100;
    const l = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(s, l);
    return new Chart(id, {
      type: 'bar',
      data: {
        // values on X-Axis
        labels: nrOfOrders.dataset.map((d) => d.label),
        datasets: [
          {
            label: title,
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
