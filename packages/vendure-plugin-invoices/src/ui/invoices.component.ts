import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import {
  getAllInvoicesQuery,
  getConfigQuery,
  upsertConfigMutation,
} from './queries.graphql';
import {
  AllInvoicesQuery,
  Invoice,
  InvoiceConfig,
  InvoiceConfigQuery,
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
            <vdr-data-table [items]="invoices">
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
  invoices: Invoice[] = [];

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
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
    await this.dataService
      .query<AllInvoicesQuery>(getAllInvoicesQuery)
      .mapStream((r) => r.allInvoices)
      .subscribe((invoices) => {
        this.invoices = invoices;
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
}
