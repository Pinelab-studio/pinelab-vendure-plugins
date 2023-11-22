import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  DataService,
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
import { firstValueFrom } from 'rxjs';
import { ConfigArgDefinition } from '@vendure/common/lib/generated-types';

@Component({
  selector: 'invoices-component',
  template: `
    <div class="page-block">
      <clr-accordion>
        <clr-accordion-panel>
          <clr-accordion-title>Settings</clr-accordion-title>
          <clr-accordion-content *clrIfExpanded>
            <section class="form-block">
              <form class="form" [formGroup]="form">
                <vdr-form-field label="Generate invoices on" for="enabled">
                  <clr-checkbox-wrapper>
                    <input
                      type="checkbox"
                      clrCheckbox
                      formControlName="enabled"
                    />
                  </clr-checkbox-wrapper>
                </vdr-form-field>
                <vdr-form-field label="HTML template" for="templateString">
                  <vdr-dynamic-form-input
                    formControlName="templateString"
                    [readonly]="false"
                    [def]="htmlFormInputConfigArgsDef"
                    [control]="form.get('templateString')"
                    style="max-width: 100%;"
                  >
                  </vdr-dynamic-form-input>
                </vdr-form-field>
                <button
                  class="btn btn-primary"
                  (click)="save()"
                  [disabled]="form.invalid || form.pristine"
                >
                  Save
                </button>
                <button class="btn btn-secondary" (click)="testDownload()">
                  Preview
                </button>
                <vdr-help-tooltip
                  content="Preview the HTML template. Uses the most recent placed order. Just a preview, it doesn't save any invoices!"
                ></vdr-help-tooltip>
              </form>
            </section>
          </clr-accordion-content>
        </clr-accordion-panel>
      </clr-accordion>

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
        <br />
        <br />
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
    </div>
  `,
})
export class InvoicesComponent implements OnInit {
  form: FormGroup;
  invoicesList: InvoiceList | undefined;
  itemsPerPage = 10;
  page = 1;
  selectedInvoices: Invoice[] = [];
  serverPath: string;
  htmlFormInputConfigArgsDef: ConfigArgDefinition = {
    name: 'templateString',
    type: 'text',
    list: false,
    required: false,
    ui: { component: 'html-editor-form-input' },
  };

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
    this.serverPath = getServerLocation();
  }

  async ngOnInit(): Promise<void> {
    this.dataService
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
        const result$ = await this.dataService.mutate<
          UpsertInvoiceConfigMutation,
          UpsertInvoiceConfigMutationVariables
        >(upsertConfigMutation, {
          input: {
            enabled: formValue.enabled,
            templateString: formValue.templateString,
          },
        });
        const { upsertInvoiceConfig: result } = await firstValueFrom(result$);
        this.form.controls['enabled'].setValue(result.enabled);
        this.form.controls['templateString'].setValue(result.templateString);
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'InvoiceConfig',
      });
    } catch (e: any) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'InvoiceConfig',
      });
    }
  }

  async downloadSelected(): Promise<void> {
    try {
      const nrs = this.selectedInvoices.map((i) => i.invoiceNumber).join(',');
      const res = await fetch(
        `${this.serverPath}/invoices/download?nrs=${nrs}`,
        {
          headers: this.getHeaders(),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw Error(json?.message);
      }
      const blob = await res.blob();
      await this.downloadBlob(blob, 'invoices.zip');
    } catch (err: any) {
      console.error(err);
      this.notificationService.error(err?.message);
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

  async testDownload() {
    try {
      const template = this.form.value.templateString;
      const res = await fetch(`${this.serverPath}/invoices/preview`, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ template }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw Error(json?.message);
      }
      const blob = await res.blob();
      await this.downloadBlob(blob, 'test-invoice.pdf', true);
    } catch (err: any) {
      console.error(err);
      this.notificationService.error(err?.message);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const channelToken = this.localStorageService.get('activeChannelToken');
    if (channelToken) {
      headers['vendure-token'] = channelToken;
    }
    const authToken = this.localStorageService.get('authToken');
    if (authToken) {
      headers.authorization = `Bearer ${authToken}`;
    }
    return headers;
  }

  private async downloadBlob(
    blob: Blob,
    fileName: string,
    openInNewTab = false
  ): Promise<void> {
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.setAttribute('hidden', 'true');
    a.href = blobUrl;
    if (!openInNewTab) {
      a.download = fileName;
    }
    a.setAttribute('target', '_blank');
    a.click();
  }
}
