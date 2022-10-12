import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import {
  getGoedgepicktConfig,
  runGoedgepicktFullSync,
  updateGoedgepicktConfig,
} from './queries.graphql';
import fetch from 'node-fetch';
import { GoedgepicktConfig } from './generated/graphql';

@Component({
  selector: 'goedgepickt-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <button
          class="btn btn-secondary"
          [disabled]="loadingSync"
          (click)="fullSync()"
        >
          Synchronize
        </button>
        <vdr-help-tooltip
          content="Pushes products and pulls stocklevels from Goedgepickt"
        ></vdr-help-tooltip>
        <form class="form" [formGroup]="form">
          <section class="form-block">
            <vdr-form-field label="Enabled" for="enabled">
              <input
                type="checkbox"
                name="enabled"
                clrCheckbox
                formControlName="enabled"
              />
            </vdr-form-field>
            <vdr-form-field label="apikey" for="apiKey">
              <input id="apiKey" type="text" formControlName="apiKey" />
            </vdr-form-field>
            <vdr-form-field label="webshopUuid" for="webshopUuid">
              <input
                id="webshopUuid"
                type="text"
                formControlName="webshopUuid"
              />
            </vdr-form-field>
            <button
              class="btn btn-primary"
              (click)="save()"
              [disabled]="form.invalid || form.pristine"
            >
              Save
            </button>
            <button class="btn btn-secondary" (click)="test()">Test</button>
            <vdr-chip *ngIf="testFailed" title="Failed" colorType="error">
              <clr-icon shape="error-standard"></clr-icon>
              {{ testFailed }}
            </vdr-chip>
            <vdr-chip
              *ngIf="testResultName"
              title="Success!"
              colorType="success"
            >
              <clr-icon shape="check-circle"></clr-icon>
              {{ testResultName }}
            </vdr-chip>
          </section>
          <section class="form-block">
            <p>
              The following settings are set automatically and cannot be edited
            </p>
            <br />
            <vdr-form-field
              label="Order webhook"
              for="orderWebhookUrl"
              tooltip="Goedgepickt will call this URL for order status updates"
            >
              <input
                id="orderWebhookUrl"
                type="text"
                formControlName="orderWebhookUrl"
                disabled="disabled"
              />
            </vdr-form-field>
            <vdr-form-field label="Webhook auth secret" for="orderWebhookKey">
              <input
                id="orderWebhookKey"
                type="text"
                formControlName="orderWebhookKey"
                disabled="disabled"
              />
            </vdr-form-field>
          </section>
          <section class="form-block">
            <vdr-form-field
              label="Stock webhook"
              for="stockWebhookUrl"
              tooltip="Goedgepickt will call this URL for stocklevel updates"
            >
              <input
                id="stockWebhookUrl"
                type="text"
                formControlName="stockWebhookUrl"
                disabled="disabled"
              />
            </vdr-form-field>
            <vdr-form-field label="Webhook auth secret" for="stockWebhookKey">
              <input
                id="stockWebhookKey"
                type="text"
                formControlName="stockWebhookKey"
                disabled="disabled"
              />
            </vdr-form-field>
          </section>
        </form>
      </div>
    </div>
  `,
})
export class GoedgepicktComponent implements OnInit {
  form: FormGroup;
  testFailed?: string;
  testResultName?: string;
  loadingSync = false;

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    this.form = this.formBuilder.group({
      enabled: ['enabled'],
      apiKey: ['your-api-key'],
      webshopUuid: ['webshopUuid'],
      orderWebhookUrl: ['orderWebhookUrl'],
      orderWebhookKey: ['orderWebhookKey'],
      stockWebhookUrl: ['stockWebhookUrl'],
      stockWebhookKey: ['stockWebhookKey'],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(getGoedgepicktConfig)
      .mapStream((d: any) => d.goedgepicktConfig)
      .subscribe((config: GoedgepicktConfig) => {
        this.form.controls['enabled'].setValue(config.enabled);
        this.form.controls['apiKey'].setValue(config.apiKey);
        this.form.controls['webshopUuid'].setValue(config.webshopUuid);
        this.form.controls['orderWebhookUrl'].setValue(config.orderWebhookUrl);
        this.form.controls['orderWebhookKey'].setValue(config.orderWebhookKey);
        this.form.controls['stockWebhookUrl'].setValue(config.stockWebhookUrl);
        this.form.controls['stockWebhookKey'].setValue(config.stockWebhookKey);
      });
  }

  async save(): Promise<void> {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        const { updateGoedgepicktConfig: result } = (await this.dataService
          .mutate(updateGoedgepicktConfig, {
            input: {
              enabled: formValue.enabled,
              apiKey: formValue.apiKey,
              webshopUuid: formValue.webshopUuid,
            },
          })
          .toPromise()) as any;
        this.form.controls['enabled'].setValue(result.enabled);
        this.form.controls['apiKey'].setValue(result.apiKey);
        this.form.controls['webshopUuid'].setValue(result.webshopUuid);
        this.form.controls['orderWebhookUrl'].setValue(result.orderWebhookUrl);
        this.form.controls['orderWebhookKey'].setValue(result.orderWebhookKey);
        this.form.controls['stockWebhookUrl'].setValue(result.stockWebhookUrl);
        this.form.controls['stockWebhookKey'].setValue(result.stockWebhookKey);
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'GoedgepicktConfig',
      });
    } catch (e) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'GoedgepicktConfig',
      });
    }
  }

  async fullSync(): Promise<void> {
    try {
      this.loadingSync = true;
      await this.dataService.mutate(runGoedgepicktFullSync).toPromise();
      this.notificationService.success('common.notify-update-success', {
        entity: 'products and stocklevels',
      });
    } catch (e) {
      this.notificationService.error(e.message);
    } finally {
      this.loadingSync = false;
    }
  }

  async test(): Promise<void> {
    this.testFailed = undefined;
    this.testResultName = undefined;
    const result = await fetch(
      'https://account.goedgepickt.nl/api/v1/webshops',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.form.controls['apiKey'].value}`,
        },
        redirect: 'follow',
      }
    );
    if (result.status !== 200) {
      this.testFailed = 'Invalid ApiKey';
      return;
    }
    const json = await result.json();
    const webshop = json.items?.find(
      (item: { uuid: string }) =>
        item.uuid === this.form.controls['webshopUuid'].value
    );
    if (!webshop) {
      this.testFailed = 'Apikey is correct, but cannot find webshopUuid';
    } else {
      this.testResultName = webshop.name;
    }
  }
}
