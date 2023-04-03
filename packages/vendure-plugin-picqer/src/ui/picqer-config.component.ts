import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import { FULL_SYNC, GET_CONFIG, TEST, UPSERT_CONFIG } from './queries';

/**
 * Component for updating Picqer configuration.
 */
@Component({
  selector: 'picqer-component',
  template: `
    <h1>Picqer configuration</h1>

    <button class="btn btn-warning-outline" [disabled]="isSaving" (click)="fullSync()">
        Run full sync
      </button>
      <br/>
      <br/>
    <section class="form-block">
      <vdr-form-field label="Enabled">
        <input type="checkbox" clrCheckbox [(ngModel)]="enabled" />
      </vdr-form-field>
      <vdr-form-field label="Api key">
        <input type="password" [(ngModel)]="apiKey" />
      </vdr-form-field>
      <vdr-form-field
        label="API endpoint"
        tooltip="Your Picqer domain, without the '/api/v1/' path "
      >
        <input type="text" [(ngModel)]="apiEndpoint" />
      </vdr-form-field>
      <vdr-form-field
        label="Storefront URL"
        tooltip="Picqer requires you to register your storefront URL and support email address for API usage."
      >
        <input type="text" [(ngModel)]="storefrontUrl" />
      </vdr-form-field>
      <vdr-form-field
        label="Support email address"
        tooltip="Picqer requires you to register your storefront URL and support email address for API usage."
      >
        <input type="text" [(ngModel)]="supportEmail" />
      </vdr-form-field>
      <!-- Form buttons -->
      <button class="btn btn-primary" [disabled]="isSaving" (click)="save()">
        Save
      </button>
      <button class="btn btn-secondary" (click)="test()">Test</button>
      <vdr-chip *ngIf="isValid === false" title="Failed" colorType="error">
        <clr-icon shape="error-standard"></clr-icon>
        Something is not right
      </vdr-chip>
      <vdr-chip *ngIf="isValid" title="Success!" colorType="success">
        <clr-icon shape="check-circle"></clr-icon>
        All good!
      </vdr-chip>
    </section>
  `,
})
export class PicqerConfigComponent implements OnInit {
  enabled: true;
  apiKey: '';
  apiEndpoint: '';
  storefrontUrl: '';
  supportEmail: '';

  isValid?: boolean = undefined;

  isSaving = false;

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(GET_CONFIG)
      .mapStream((r: any) => r.picqerConfig)
      .subscribe((config) => {
        if (config) {
          this.enabled = config.enabled;
          this.apiKey = config.apiKey;
          this.apiEndpoint = config.apiEndpoint;
          this.storefrontUrl = config.storefrontUrl;
          this.supportEmail = config.supportEmail;
        }
      });
  }

  async save(): Promise<void> {
    const { upsertPicqerConfig: result } = await this.tryAndNotify(
      this.dataService
        .mutate(UPSERT_CONFIG, {
          input: {
            enabled: this.enabled,
            apiKey: this.apiKey,
            apiEndpoint: this.apiEndpoint,
            storefrontUrl: this.storefrontUrl,
            supportEmail: this.supportEmail,
          },
        })
        .toPromise(),
      'Saved',
      'Failed to save'
    );
    if (result) {
      this.enabled = result.enabled;
      this.apiKey = result.apiKey;
      this.apiEndpoint = result.apiEndpoint;
      this.storefrontUrl = result.storefrontUrl;
      this.supportEmail = result.supportEmail;
    }
  }

  async fullSync(): Promise<void> {
    await this.tryAndNotify(
      this.dataService.mutate(FULL_SYNC).toPromise(),
      'Full sync started, this might take a while',
      'Failed to start sync'
    );
  }

  async test(): Promise<void> {
    this.isValid = undefined;
    const result = this.dataService
      .query(TEST, {
        input: {
          apiKey: this.apiKey,
          apiEndpoint: this.apiEndpoint,
          storefrontUrl: this.storefrontUrl,
          supportEmail: this.supportEmail,
        },
      })
      .mapSingle((r: any) => r.isPicqerConfigValid)
      .subscribe((isValid: boolean) => (this.isValid = isValid));
  }

  /**
   * Wrap in try catch with notifications
   */
  private async tryAndNotify(
    promise: Promise<any>,
    successmessage: string,
    failedMessage: string
  ): Promise<any | undefined> {
    try {
      const res = await promise;
      this.notificationService.success(successmessage);
      return res;
    } catch (e) {
      this.notificationService.error(failedMessage);
      console.error(e);
    }
  }
}
