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

@Component({
  selector: 'invoices-detail-view',
  templateUrl: './invoices-detail-view.component.html',
})
export class InvoiceDetailViewComponent
  implements CustomDetailComponent, OnInit
{
  entity$: Observable<any>;
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
  async ngOnInit(): Promise<void> {
    this.dataService.client
      .userStatus()
      .mapStream((data) => data.userStatus.permissions)
      .subscribe(async (permissions) => {
        if (permissions.includes('AllowInvoicesPermission' as any)) {
          await this.getOrderInvoices();
        } else {
          console.warn('Current user doesnt have permission to view invoices');
        }
      });
  }

  async getOrderInvoices(): Promise<void> {
    this.entity$.subscribe((order: any) => {
      this.dataService
        .query(getOrderWithInvoices, {
          id: order?.id,
        })
        .mapStream((r: any) => r.order.invoices)
        .subscribe((result) => {
          this.invoicesList = result;
          this.cdr.markForCheck();
        });
    });
  }

  async setPageNumber(page: number) {
    this.page = page;
    await this.getOrderInvoices();
  }

  async setItemsPerPage(nrOfItems: number) {
    this.page = 1;
    this.itemsPerPage = Number(nrOfItems);
    await this.getOrderInvoices();
  }
}
