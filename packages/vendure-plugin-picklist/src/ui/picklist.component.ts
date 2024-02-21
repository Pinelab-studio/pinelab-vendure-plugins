import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  DataService,
  getServerLocation,
  LocalStorageService,
  NotificationService,
} from '@vendure/admin-ui/core';
import { getConfigQuery, upsertConfigMutation } from './queries.graphql';
import {
  PicklistConfigQuery,
  UpsertPicklistConfigMutation,
  UpsertPicklistConfigMutationVariables,
} from './generated/graphql';
import { firstValueFrom } from 'rxjs';
import { ConfigArgDefinition } from '@vendure/common/lib/generated-types';
@Component({
  selector: 'vdr-picklist-component',
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
            <vdr-form-field label="Order Code">
              <clr-input-container>
                <input type="text" clrInput formControlName="orderCode" />
              </clr-input-container>
            </vdr-form-field>
            <button
              class="btn btn-primary preview-button"
              (click)="testDownload()"
              [disabled]="picklistPreviewLoading"
            >
              Preview Template
            </button>
          </form>
        </vdr-card>
      </vdr-page-block>
    </div>
  `,
  styleUrls: ['./picklist.component.scss'],
})
export class PicklistComponent implements OnInit {
  form: FormGroup;
  serverPath: string;
  picklistPreviewLoading: boolean = false;
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
      templateString: ['templateString'],
      orderCode: [''],
    });
    this.serverPath = getServerLocation();
  }

  async ngOnInit(): Promise<void> {
    this.dataService
      .query<PicklistConfigQuery>(getConfigQuery)
      .mapStream((d) => d.picklistConfig)
      .subscribe((config) => {
        this.form.controls['templateString'].setValue(config?.templateString);
        this.renderNow = true;
        this.changeDetector.markForCheck();
      });
  }

  async save() {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        const result$ = await this.dataService.mutate<
          UpsertPicklistConfigMutation,
          UpsertPicklistConfigMutationVariables
        >(upsertConfigMutation, {
          templateString: formValue.templateString,
        });
        const { upsertPicklistConfig: result } = await firstValueFrom(result$);
        this.form.controls['templateString'].setValue(result.templateString);
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'PicklistConfig',
      });
    } catch (e: any) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'PicklistConfig',
      });
    }
  }

  async testDownload() {
    try {
      const template = this.form.value.templateString;
      const orderCode = this.form.value.orderCode;
      this.picklistPreviewLoading = true;
      this.changeDetector.markForCheck();
      const res = await fetch(
        `${this.serverPath}/picklists/preview/${orderCode}`,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({ template }),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw Error(json?.message);
      }
      const blob = await res.blob();
      await this.downloadBlob(blob, 'test-picklist.pdf', true);
    } catch (err: any) {
      console.error(err);
      this.notificationService.error(err?.message);
    }
    this.picklistPreviewLoading = false;
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
