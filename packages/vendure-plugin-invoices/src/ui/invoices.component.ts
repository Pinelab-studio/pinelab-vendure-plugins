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
                <vdr-form-field label="Order Code" for="enabled">
                  <clr-input-container>
                    <input type="text" clrInput formControlName="orderCode" />
                  </clr-input-container>
                </vdr-form-field>
                <button
                  class="btn btn-primary"
                  (click)="save()"
                  [disabled]="form.invalid || form.pristine"
                >
                  Save
                </button>
                <button
                  class="btn btn-secondary"
                  (click)="testDownload()"
                  [disabled]="
                    !form.get('orderCode')?.value || invoicePreviewLoading
                  "
                >
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
    </div>
  `,
})
export class InvoicesComponent implements OnInit {
  form: FormGroup;
  serverPath: string;
  invoicePreviewLoading: boolean = false;
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
    private localStorageService: LocalStorageService,
  ) {
    this.form = this.formBuilder.group({
      enabled: ['enabled'],
      templateString: ['templateString'],
      orderCode: [''],
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

  async testDownload() {
    try {
      const template = this.form.value.templateString;
      const orderCode = this.form.value.orderCode;
      this.invoicePreviewLoading = true;
      this.changeDetector.markForCheck();
      const res = await fetch(
        `${this.serverPath}/invoices/preview/${orderCode}`,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({ template }),
        },
      );
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
    this.invoicePreviewLoading = false;
    this.changeDetector.markForCheck();
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
    openInNewTab = false,
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
