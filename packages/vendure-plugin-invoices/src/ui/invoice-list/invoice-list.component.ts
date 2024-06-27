import { gql, TypedDocumentNode } from '@apollo/client';
import {
  TypedBaseListComponent,
  SharedModule,
  LogicalOperator,
} from '@vendure/admin-ui/core';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Invoice, InvoiceListOptions } from '../generated/graphql';

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
    .addFilter({
      name: 'orderCode',
      type: { kind: 'text' },
      label: 'Order Code',
      filterField: 'orderCode',
    })
    .addFilter({
      name: 'invoiceNumber',
      type: { kind: 'text' },
      label: 'Invoice Number',
      filterField: 'invoiceNumber',
    })
    .connectToRoute(this.route);

  constructor() {
    super();
    super.configure({
      document: typedDocumentNode,
      getItems: (data) => data.invoices,
      setVariables: (skip, take) =>
        this.createQueryOptions(skip, take, this.searchTermControl.value),
      refreshListOnChanges: [this.filters.valueChanges],
    });
  }

  private createQueryOptions(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    skip: number,
    take: number,
    searchTerm: string | null
  ): { options: InvoiceListOptions } {
    let filterInput = this.filters.createFilterInput();
    if (searchTerm) {
      filterInput = {
        invoiceNumber: {
          contains: searchTerm,
        },
        orderCode: {
          contains: searchTerm,
        },
      };
    }
    return {
      options: {
        skip,
        take,
        filter: {
          ...(filterInput ?? {}),
        },
        filterOperator: searchTerm ? LogicalOperator.OR : LogicalOperator.AND,
      },
    };
  }
}
