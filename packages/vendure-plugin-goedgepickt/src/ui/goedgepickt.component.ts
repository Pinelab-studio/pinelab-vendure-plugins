import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import { getGoedgepicktConfig, updateGoedgepicktConfig } from './queries';
import fetch from 'node-fetch';

@Component({
  selector: 'goedgepickt-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <form class="form" [formGroup]="form">
          <section class="form-block">
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
        </form>
      </div>
    </div>
  `,
})
export class GoedgepicktComponent implements OnInit {
  form: FormGroup;
  orderWebhookKey?: string;
  stockWebhookKey?: string;
  testFailed?: string;
  testResultName?: string;

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    this.form = this.formBuilder.group({
      apiKey: ['your-api-key'],
      webshopUuid: ['webshopUuid'],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(getGoedgepicktConfig)
      .mapStream((d: any) => d.goedgepicktConfig)
      .subscribe((config) => {
        if (!config) {
          return;
        }
        this.form.controls['apiKey'].setValue(config.apiKey);
        this.form.controls['webshopUuid'].setValue(config.webshopUuid);
        this.orderWebhookKey = config.orderWebhookKey;
        this.stockWebhookKey = config.stockWebhookKey;
      });
  }

  async save(): Promise<void> {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        await this.dataService
          .mutate(updateGoedgepicktConfig, {
            input: {
              apiKey: formValue.apiKey,
              webshopUuid: formValue.webshopUuid,
            },
          })
          .toPromise();
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
