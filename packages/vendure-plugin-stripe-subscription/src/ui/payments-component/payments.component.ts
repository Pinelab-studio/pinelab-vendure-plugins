import { Component, OnInit } from '@angular/core';
import { TypedBaseListComponent } from '@vendure/admin-ui/core';
import { StripeSubscriptionPaymentsDocument } from '../generated/graphql';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import {
  DataService,
  ModalService,
  NotificationService,
} from '@vendure/admin-ui/core';
@Component({
  selector: 'payments-component',
  templateUrl: './payments-component.html',
})
export class PaymentsComponent
  extends TypedBaseListComponent<
    typeof StripeSubscriptionPaymentsDocument,
    'stripeSubscriptionPayments'
  >
  implements OnInit
{
  readonly filters: any = (
    this.createFilterCollection().addDateFilters() as any
  )
    .addFilters([
      {
        name: 'id',
        type: { kind: 'text' },
        label: _('common.id'),
        filterField: 'id',
      },
    ])
    .connectToRoute(this.route);
  readonly sorts: any = this.createSortCollection()
    .defaultSort('createdAt', 'DESC')
    .addSorts([
      { name: 'id' },
      { name: 'createdAt' },
      { name: 'updatedAt' },
      { name: 'name' },
      { name: 'collectionMethod' },
      { name: 'charge' },
      { name: 'currency' },
      { name: 'orderCode' },
      { name: 'channelId' },
      { name: 'subscriptionId' },
    ])
    .connectToRoute(this.route);
  ngOnInit(): void {
    super.ngOnInit();
  }
  constructor(
    protected dataService: DataService,
    private modalService: ModalService,
    private notificationService: NotificationService
  ) {
    super();
    this.configure({
      document: StripeSubscriptionPaymentsDocument,
      getItems: (data) => data.stripeSubscriptionPayments,
      setVariables: (skip, take) =>
        ({
          options: {
            skip,
            take,
            filter: {
              name: {
                contains: this.searchTermControl.value,
              },
              ...this.filters.createFilterInput(),
            },
            sort: this.sorts.createSortInput() as any,
          },
        } as any),
      refreshListOnChanges: [
        this.sorts.valueChanges,
        this.filters.valueChanges,
      ],
    });
  }
}
