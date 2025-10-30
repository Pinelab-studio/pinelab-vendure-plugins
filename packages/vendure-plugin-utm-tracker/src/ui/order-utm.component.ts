import { Component, OnInit } from '@angular/core';
import { Observable, switchMap, distinctUntilChanged, take } from 'rxjs';
import { FormGroup } from '@angular/forms';
import {
  DataService,
  CustomDetailComponent,
  SharedModule,
} from '@vendure/admin-ui/core';
import gql from 'graphql-tag';
import { Order } from '@vendure/core';

interface UtmOrderParameter {
  __typename: 'UtmOrderParameter';
  id: string;
  createdAt: string;
  updatedAt: string;
  connectedAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  attributedPercentage: number;
  attributedValue: number;
}

/**
 * Display UTM parameters on the order detail page.
 */
@Component({
  template: ` <vdr-card title="UTM Parameters">
    <div class="contents">
      <div *ngIf="(utmParams$ | async)?.length as len; else noData">
        <table class="table">
          <thead>
            <tr>
              <th>Connected</th>
              <th>Source</th>
              <th>Medium</th>
              <th>Campaign</th>
              <th>Term</th>
              <th>Attributed Value</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of utmParams$ | async; let i = index">
              <td>{{ p.connectedAt | date : 'short' }}</td>
              <td>{{ p.utmSource }}</td>
              <td>{{ p.utmMedium }}</td>
              <td>{{ p.utmCampaign }}</td>
              <td>{{ p.utmTerm }}</td>
              <td *ngIf="p.attributedValue > 0">
                {{ p.attributedValue / 100 | currency }} ({{
                  p.attributedPercentage * 100 | number : '1.0-0'
                }}%)
              </td>
              <td *ngIf="!p.attributedValue">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <ng-template #noData>
      <div class="alert alert-info">
        No UTM parameters found for this order.
      </div>
    </ng-template>
  </vdr-card>`,
  standalone: true,
  imports: [SharedModule],
})
export class UtmOrderComponent implements CustomDetailComponent, OnInit {
  // These two properties are provided by Vendure and will vary
  // depending on the particular detail page you are embedding this
  // component into. In this case, it will be a "product" entity.
  entity$!: Observable<Order>;
  detailForm!: FormGroup;

  utmParams$!: Observable<UtmOrderParameter[]>;

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.utmParams$ = this.entity$.pipe(
      distinctUntilChanged((a, b) => a?.id === b?.id),
      switchMap((order) =>
        this.dataService
          .query<any, { orderId: string }>(GET_UTM_PARAMETERS, {
            orderId: String(order.id),
          })
          .mapStream((r: any) => r.order.utmParameters)
          .pipe(take(1))
      )
    );
  }

  trackByIndex(index: number) {
    return index;
  }
}

export const GET_UTM_PARAMETERS = gql`
  query GetUtmParameters($orderId: ID!) {
    order(id: $orderId) {
      id
      utmParameters {
        id
        createdAt
        updatedAt
        connectedAt
        utmSource
        utmMedium
        utmCampaign
        utmTerm
        utmContent
        attributedPercentage
        attributedValue
      }
    }
  }
`;
