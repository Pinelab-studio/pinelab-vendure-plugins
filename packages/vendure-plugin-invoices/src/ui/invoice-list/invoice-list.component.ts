import { gql, TypedDocumentNode } from '@apollo/client';
import { TypedBaseListComponent, SharedModule } from '@vendure/admin-ui/core';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Invoice } from '../generated/graphql';

const GET_INVOICES_QUERY = gql`
  query InvoiceList($options: InvoiceListOptions) {
    invoices(options: $options) {
      items {
        id
        createdAt
        invoiceNumber
        downloadUrl
        isCreditInvoice
        orderCode
        orderId
      }
      totalItems
    }
  }
`;

const typedDocumentNode: TypedDocumentNode<{
  invoices: { items: Invoice[]; totalItems: number };
}> = GET_INVOICES_QUERY;

@Component({
  selector: 'invoice-list',
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SharedModule],
})
export class InvoiceListComponent extends TypedBaseListComponent<
  typeof typedDocumentNode,
  'invoices'
> {
  // Here we set up the filters that will be available
  // to use in the data table
  readonly filters = this.createFilterCollection()
    .addIdFilter()
    .addDateFilters()
    .connectToRoute(this.route);

  // Here we set up the sorting options that will be available
  // to use in the data table
  readonly sorts = this.createSortCollection()
    .defaultSort('createdAt', 'DESC')
    .addSort({ name: 'createdAt' })
    .connectToRoute(this.route);

  constructor() {
    super();
    super.configure({
      document: typedDocumentNode,
      getItems: (data) => data.invoices,
      setVariables: (skip, take) => ({
        options: {
          skip,
          take,
        },
      }),
      refreshListOnChanges: [
        this.filters.valueChanges,
        this.sorts.valueChanges,
      ],
    });
  }
}
