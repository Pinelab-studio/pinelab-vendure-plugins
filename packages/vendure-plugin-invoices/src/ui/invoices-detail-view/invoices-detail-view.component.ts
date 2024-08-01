import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import {
  DataService,
  CustomDetailComponent,
  getServerLocation,
} from '@vendure/admin-ui/core';
import { Observable } from 'rxjs';
import { Invoice } from '../generated/graphql';
import { getOrderWithInvoices } from './invoices-detail-view';
import { Permission, Order } from '@vendure/admin-ui/core';

@Component({
  selector: 'invoices-detail-view',
  templateUrl: './invoices-detail-view.component.html',
})
export class InvoiceDetailViewComponent
  implements CustomDetailComponent, OnInit
{
  entity$: Observable<Order>;
  detailForm: UntypedFormGroup;
  invoicesList: Invoice[] | undefined;
  itemsPerPage = 10;
  serverPath: string;
  page = 1;
  selectedInvoices: Invoice[] = [];
  constructor(
    protected dataService: DataService,
    private cdr: ChangeDetectorRef
  ) {
    this.serverPath = getServerLocation();
  }
  ngOnInit(): void {
    this.dataService.client
      .userStatus()
      .mapStream((data) => data.userStatus.permissions)
      .subscribe((permissions) => {
        if (permissions.includes('AllowInvoicesPermission' as Permission)) {
          this.getOrderInvoices();
        } else {
          console.warn('Current user doesnt have permission to view invoices');
        }
      });
  }

  getOrderInvoices(): void {
    this.entity$.subscribe((order: Order) => {
      this.dataService
        .query(getOrderWithInvoices, {
          id: order?.id,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        .mapStream((r: any) => r.order.invoices as Invoice[])
        .subscribe((result) => {
          this.invoicesList = result;
          this.cdr.markForCheck();
        });
    });
  }

  setPageNumber(page: number) {
    this.page = page;
    this.getOrderInvoices();
  }

  setItemsPerPage(nrOfItems: number) {
    this.page = 1;
    this.itemsPerPage = Number(nrOfItems);
    this.getOrderInvoices();
  }
}
