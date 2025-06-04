import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  DataService,
  getServerLocation,
  LocalStorageService,
  NotificationService,
} from '@vendure/admin-ui/core';
import { getConfigQuery, upsertConfigMutation } from './queries.graphql';
import {
  InvoiceConfigQuery,
  UpsertInvoiceConfigMutation,
  UpsertInvoiceConfigMutationVariables,
} from './generated/graphql';
import { firstValueFrom } from 'rxjs';
import { ConfigArgDefinition } from '@vendure/common/lib/generated-types';
import { downloadBlob, getHeaders } from './providers';

@Component({
  standalone: false,
  selector: 'invoices-component',
  template: `
    <div class="page-block">
      <vdr-page-block>
        <vdr-action-bar>
          <vdr-ab-right>
            <button
              class="btn btn-primary"
              (click)="save()"
              [disabled]="form.invalid || form.get('templateString')?.pristine"
            >
              {{ 'common.update' | translate }}
            </button>
          </vdr-ab-right>
        </vdr-action-bar>
      </vdr-page-block>
      <vdr-page-block>
        <vdr-card>
          <form class="form" [formGroup]="form">
            <vdr-form-field label="Generate invoices on" for="enabled">
              <clr-checkbox-wrapper>
                <input type="checkbox" clrCheckbox formControlName="enabled" />
              </clr-checkbox-wrapper>
            </vdr-form-field>
            <vdr-form-field label="HTML template" for="templateString">
              <vdr-dynamic-form-input
                *ngIf="renderNow"
                formControlName="templateString"
                [readonly]="false"
                [def]="htmlFormInputConfigArgsDef"
                [control]="form.get('templateString')"
                style="max-width: 100%;"
              >
              </vdr-dynamic-form-input>
            </vdr-form-field>
            <vdr-form-field label="Order Code" for="enabled">
              <clr-input-container>
                <input type="text" clrInput formControlName="orderCode" />
              </clr-input-container>
            </vdr-form-field>
            <button
              class="btn btn-primary preview-button"
              (click)="testDownload()"
              [disabled]="invoicePreviewLoading"
            >
              Preview Template
            </button>
          </form>
        </vdr-card>
      </vdr-page-block>
    </div>
  `,
  styleUrls: ['./invoices.component.scss'],
})
export class InvoicesComponent implements OnInit {
  form: FormGroup;
  serverPath: string;
  invoicePreviewLoading: boolean = false;
  renderNow = false;
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
      orderCode: [''],
    });
    this.serverPath = getServerLocation();
  }

  ngOnInit(): void {
    this.dataService
      .query<InvoiceConfigQuery>(getConfigQuery)
      .mapStream((d) => d.invoiceConfig)
      .subscribe((config) => {
        this.form.controls['enabled'].setValue(config?.enabled);
        this.renderNow = true;
        this.form.controls['templateString'].setValue(config?.templateString);
      });
  }

  async save() {
    try {
      if (this.form.dirty) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const formValue = this.form.value;
        const result$ = this.dataService.mutate<
          UpsertInvoiceConfigMutation,
          UpsertInvoiceConfigMutationVariables
        >(upsertConfigMutation, {
          input: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            enabled: formValue.enabled as boolean,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            templateString: formValue.templateString as string,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'InvoiceConfig',
      });
    }
  }

  async testDownload() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const template = this.form.value.templateString as string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const orderCode = this.form.value.orderCode as string;
      this.invoicePreviewLoading = true;
      this.changeDetector.markForCheck();
      const res = await fetch(
        `${this.serverPath}/invoices/preview/${orderCode}`,
        {
          headers: {
            ...getHeaders(this.localStorageService),
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({ template }),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw Error(JSON.stringify(json?.message));
      }
      const blob = await res.blob();
      downloadBlob(blob, 'test-invoice.pdf', true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(JSON.stringify(err));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.notificationService.error(JSON.stringify(err?.message));
    }
    this.invoicePreviewLoading = false;
    this.changeDetector.markForCheck();
  }
}
