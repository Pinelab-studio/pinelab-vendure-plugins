import { Component, NgModule, OnInit } from '@angular/core';
import { SharedModule } from '@vendure/admin-ui/core';
import { NgxChartsModule } from '@swimlane/ngx-charts';

@Component({
  selector: 'metrics-wdiget',
  template: `
    <ngx-charts-bar-vertical
      [view]="view"
      [scheme]="colorScheme"
      [results]="single"
      [gradient]="gradient"
      [xAxis]="showXAxis"
      [yAxis]="showYAxis"
      [legend]="false"
      [showXAxisLabel]="showXAxisLabel"
      [showYAxisLabel]="showYAxisLabel"
      [xAxisLabel]="xAxisLabel"
      [yAxisLabel]="yAxisLabel"
      (select)="onSelect($event)"
    >
    </ngx-charts-bar-vertical>
  `,
  styles: [],
})
export class MetricsWidgetComponent implements OnInit {
  // FIXME: niet gebruiken, library outdated. Beter simpele HTML library

  single: any[] = [
    {
      name: 'Germany',
      value: 8940000,
    },
    {
      name: 'USA',
      value: 5000000,
    },
    {
      name: 'France',
      value: 7200000,
    },
  ];
  multi: any[] = [];

  view = [400];

  // options
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  xAxisLabel = 'Country';
  showYAxisLabel = true;
  yAxisLabel = 'Population';

  colorScheme = {
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'],
  };

  constructor() {
    Object.assign(this, { single: this.single });
  }

  ngOnInit() {}

  onSelect(event) {
    console.log(event);
  }
}

@NgModule({
  imports: [SharedModule, NgxChartsModule],
  declarations: [MetricsWidgetComponent],
})
export class MetricsWidgetModule {}
