import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  DataService,
  getAppConfig,
  getServerLocation,
  LocalStorageService,
  NotificationService,
} from '@vendure/admin-ui/core';
import {
  getAllInvoicesQuery,
  getConfigQuery,
  upsertConfigMutation,
} from './queries.graphql';
import {
  Invoice,
  InvoiceConfig,
  InvoiceConfigQuery,
  InvoiceList,
  InvoicesQuery,
  InvoicesQueryVariables,
  UpsertInvoiceConfigMutation,
  UpsertInvoiceConfigMutationVariables,
} from './generated/graphql';

@Component({
  selector: 'invoices-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <form class="form" [formGroup]="form">
          <section class="form-block">
            <vdr-form-field label="Generate invoices on" for="enabled">
              <clr-checkbox-wrapper>
                <input type="checkbox" clrCheckbox formControlName="enabled" />
              </clr-checkbox-wrapper>
            </vdr-form-field>
            <vdr-form-field label="HTML template" for="templateString">
              <textarea
                id="templateString"
                type="text"
                formControlName="templateString"
                style="height: 300px; width: 100%;"
              ></textarea>
              <vdr-help-tooltip
                content="Use an external HTML editor to edit your template. Use Handlebars for variables."
              ></vdr-help-tooltip>
            </vdr-form-field>
            <button
              class="btn btn-primary"
              (click)="save()"
              [disabled]="form.invalid || form.pristine"
            >
              Save
            </button>
          </section>
          <hr />
          <section>
            <h2>Created invoices</h2>
            <button
              class="btn btn-primary"
              (click)="downloadSelected()"
              [disabled]="selectedInvoices?.length == 0"
            >
              Download
            </button>
            <vdr-data-table
              [items]="invoicesList?.items"
              [itemsPerPage]="itemsPerPage"
              [totalItems]="invoicesList?.totalItems"
              [currentPage]="page"
              (pageChange)="setPageNumber($event)"
              (itemsPerPageChange)="setItemsPerPage($event)"
              [allSelected]="areAllSelected()"
              [isRowSelectedFn]="isSelected"
              (rowSelectChange)="toggleSelect($event)"
              (allSelectChange)="toggleSelectAll()"
            >
              <vdr-dt-column>Invoice nr.</vdr-dt-column>
              <vdr-dt-column>Created</vdr-dt-column>
              <vdr-dt-column>Customer</vdr-dt-column>
              <vdr-dt-column>Order</vdr-dt-column>
              <vdr-dt-column>Download</vdr-dt-column>
              <ng-template let-invoice="item">
                <td class="left align-middle">{{ invoice.invoiceNumber }}</td>
                <td class="left align-middle">
                  {{ invoice.createdAt | date }}
                </td>
                <td class="left align-middle">{{ invoice.customerEmail }}</td>
                <td class="left align-middle">
                  <a [routerLink]="['/orders', invoice.orderId]">
                    {{ invoice.orderCode }}
                  </a>
                </td>
                <td class="left align-middle">
                  <a [href]="invoice.downloadUrl" target="_blank">
                    <clr-icon shape="download"></clr-icon>
                  </a>
                </td>
              </ng-template>
            </vdr-data-table>
          </section>
        </form>
      </div>
    </div>
  `,
})
export class InvoicesComponent implements OnInit {
  form: FormGroup;
  invoicesList: InvoiceList | undefined;
  itemsPerPage = 10;
  page = 1;
  selectedInvoices: Invoice[] = [];

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService,
    private localStorageService: LocalStorageService
  ) {
    this.form = this.formBuilder.group({
      enabled: ['enabled'],
      templateString: ['templateString'],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query<InvoiceConfigQuery>(getConfigQuery)
      .mapStream((d) => d.invoiceConfig)
      .subscribe((config) => {
        this.form.controls['enabled'].setValue(config?.enabled);
        this.form.controls['templateString'].setValue(config?.templateString);
      });
    await this.getAllInvoices();
  }

  async getAllInvoices(): Promise<void> {
    await this.dataService
      .query<InvoicesQuery, InvoicesQueryVariables>(getAllInvoicesQuery, {
        input: {
          page: this.page,
          itemsPerPage: this.itemsPerPage,
        },
      })
      .mapStream((r) => r.invoices)
      .subscribe((result) => {
        this.invoicesList = result;
      });
  }

  async save() {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        const { upsertInvoiceConfig: result } = await this.dataService
          .mutate<
            UpsertInvoiceConfigMutation,
            UpsertInvoiceConfigMutationVariables
          >(upsertConfigMutation, {
            input: {
              enabled: formValue.enabled,
              templateString: formValue.templateString,
            },
          })
          .toPromise();
        this.form.controls['enabled'].setValue(result.enabled);
        this.form.controls['templateString'].setValue(result.templateString);
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'InvoiceConfig',
      });
    } catch (e) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'InvoiceConfig',
      });
    }
  }

  async downloadSelected(): Promise<void> {
    try {
      const nrs = this.selectedInvoices.map((i) => i.invoiceNumber).join(',');
      const res = await this.fetch(`invoices/download?nrs=${nrs}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.setAttribute('hidden', 'true');
      a.href = blobUrl;
      a.download = 'invoices.zip';
      a.setAttribute('target', '_blank');
      a.click();
      // window.open(blobUrl, "_blank")?.focus();
    } catch (err) {
      console.error(err);
      this.notificationService.error(err.message);
    }
  }

  async setPageNumber(page: number) {
    this.page = page;
    await this.getAllInvoices();
  }

  async setItemsPerPage(nrOfItems: number) {
    this.page = 1;
    this.itemsPerPage = Number(nrOfItems);
    await this.getAllInvoices();
  }

  isSelected = (row: Invoice): boolean => {
    return !!this.selectedInvoices?.find((selected) => selected.id === row.id);
  };

  toggleSelect(row: Invoice): void {
    if (this.isSelected(row)) {
      this.selectedInvoices = this.selectedInvoices.filter(
        (s) => s.id !== row.id
      );
    } else {
      this.selectedInvoices.push(row);
    }
  }

  toggleSelectAll() {
    if (this.areAllSelected()) {
      this.selectedInvoices = [];
    } else {
      this.selectedInvoices = this.invoicesList?.items || [];
    }
  }

  areAllSelected(): boolean {
    return this.selectedInvoices.length === this.invoicesList?.items.length;
  }

  private fetch(path: string) {
    const url = `${getServerLocation()}/${path}`;
    const headers: Record<string, string> = {};
    const channelToken = this.localStorageService.get('activeChannelToken');
    if (channelToken) {
      headers['vendure-token'] = channelToken;
    }
    const authToken = this.localStorageService.get('authToken');
    if (authToken) {
      headers.authorization = `Bearer ${authToken}`;
    }
    return fetch(url, {
      headers,
    });
  }
}
