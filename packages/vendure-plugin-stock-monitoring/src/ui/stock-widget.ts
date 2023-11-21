import { Component, NgModule, OnInit } from '@angular/core';
import { DataService, SharedModule } from '@vendure/admin-ui/core';
import { ProductVariant } from '@vendure/core';
import { Observable } from 'rxjs';
import gql from 'graphql-tag';

@Component({
  standalone: true,
  imports: [SharedModule],
  selector: 'stock-widget',
  template: `
    <vdr-data-table [items]="variant$ | async" class="stock-widget-overflow">
      <ng-template let-variant="item">
        <td
          class="left align-middle"
          [class.out-of-stock]="!variant.stockOnHand"
        >
          <a [routerLink]="['/catalog', 'inventory', variant.productId]">{{
            variant.name
          }}</a>
        </td>
        <td
          class="left align-middle"
          [class.out-of-stock]="!variant.stockOnHand"
        >
          {{ reduceSum(variant.stockLevels) }}
        </td>
      </ng-template>
    </vdr-data-table>
  `,
  styles: [
    '.out-of-stock { background-color: #FCE2DE;}',
    '.stock-widget-overflow { max-height: 300px; overflow: scroll; }',
  ],
})
export class StockWidgetComponent implements OnInit {
  constructor(private dataService: DataService) {}

  variant$: Observable<ProductVariant[]>;

  ngOnInit() {
    this.variant$ = this.dataService
      .query(
        gql`
          query productVariantsWithLowStock {
            productVariantsWithLowStock {
              id
              name
              enabled
              stockOnHand
              productId
              stockLevels {
                stockOnHand
              }
            }
          }
        `
      )
      .mapStream((data) => (data as any).productVariantsWithLowStock);
  }

  reduceSum(stockLevels: any[]): number {
    return stockLevels.reduce((acc, val) => (acc += val.stockOnHand), 0);
  }
}
