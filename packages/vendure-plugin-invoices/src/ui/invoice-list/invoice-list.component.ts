import { gql, TypedDocumentNode } from '@apollo/client';
import {
  TypedBaseListComponent,
  SharedModule,
  LogicalOperator,
  NotificationService,
  DataService
} from '@vendure/admin-ui/core';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ExportInvoiceToAccountingPlatformMutation, Invoice, InvoiceListOptions } from '../generated/graphql';
import { exportToAccounting } from '../queries.graphql';

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
        accountingReference {
          reference
          link
          errorMessage
        }
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

  constructor(
    protected dataService: DataService, private notificationService: NotificationService
  ) {
    super();
    super.configure({
      document: typedDocumentNode,
      getItems: (data) => data.invoices,
      setVariables: (skip, take) =>
        this.createQueryOptions(skip, take, this.searchTermControl.value),
      refreshListOnChanges: [this.filters.valueChanges],
    });
  }

  exportToAccounting(invoiceNumber: number) {
    this.dataService
    .mutate<ExportInvoiceToAccountingPlatformMutation>(exportToAccounting, {invoiceNumber})
    .subscribe(() => {
      this.notificationService.success(`Started export`);
    });
  }

  private createQueryOptions(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    skip: number,
    take: number,
    searchTerm: string | null
  ): { options: InvoiceListOptions } {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        filter: {
          ...(filterInput ?? {}),
        },
        filterOperator: searchTerm ? LogicalOperator.OR : LogicalOperator.AND,
      },
    };
  }
}
