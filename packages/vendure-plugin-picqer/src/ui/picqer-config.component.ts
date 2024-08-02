import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import { FULL_SYNC, GET_CONFIG, TEST, UPSERT_CONFIG } from './queries';
import {
  IsPicqerConfigValidQuery,
  IsPicqerConfigValidQueryVariables,
  PicqerConfigQuery,
  PicqerConfigQueryVariables,
  UpsertPicqerConfigMutation,
  UpsertPicqerConfigMutationVariables,
} from './generated/graphql';

/**
 * Component for updating Picqer configuration.
 */
@Component({
  selector: 'picqer-component',
  template: `
    <h1>Picqer configuration</h1>

    <button
      class="btn btn-warning-outline"
      [disabled]="isSaving"
      (click)="fullSync()"
    >
      Run full sync
    </button>
    <br />
    <br />
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
  enabled: boolean = true;
  apiKey: string = '';
  apiEndpoint: string = '';
  storefrontUrl: string = '';
  supportEmail: string = '';

  isValid?: boolean = undefined;

  isSaving = false;

  constructor(
    protected dataService: DataService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.dataService
      .query<PicqerConfigQuery, PicqerConfigQueryVariables>(GET_CONFIG)
      .mapStream((r) => r.picqerConfig)
      .subscribe((config) => {
        if (config) {
          this.enabled = config.enabled as boolean;
          this.apiKey = config.apiKey as string;
          this.apiEndpoint = config.apiEndpoint as string;
          this.storefrontUrl = config.storefrontUrl as string;
          this.supportEmail = config.supportEmail as string;
        }
      });
  }

  async save(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { upsertPicqerConfig: result } = (await this.tryAndNotify(
      this.dataService
        .mutate<
          UpsertPicqerConfigMutation,
          UpsertPicqerConfigMutationVariables
        >(UPSERT_CONFIG, {
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
    )) as UpsertPicqerConfigMutation;
    if (result) {
      this.enabled = result.enabled as boolean;
      this.apiKey = result.apiKey as string;
      this.apiEndpoint = result.apiEndpoint as string;
      this.storefrontUrl = result.storefrontUrl as string;
      this.supportEmail = result.supportEmail as string;
    }
  }

  async fullSync(): Promise<void> {
    await this.tryAndNotify(
      this.dataService.mutate(FULL_SYNC).toPromise(),
      'Full sync started, this might take a while',
      'Failed to start sync'
    );
  }

  test(): void {
    this.isValid = undefined;
    this.dataService
      .query<IsPicqerConfigValidQuery, IsPicqerConfigValidQueryVariables>(
        TEST,
        {
          input: {
            apiKey: this.apiKey,
            apiEndpoint: this.apiEndpoint,
            storefrontUrl: this.storefrontUrl,
            supportEmail: this.supportEmail,
          },
        }
      )
      .mapSingle((r) => r.isPicqerConfigValid)
      .subscribe((isValid: boolean) => (this.isValid = isValid));
  }

  /**
   * Wrap in try catch with notifications
   */
  private async tryAndNotify(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    promise: Promise<any>,
    successmessage: string,
    failedMessage: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    try {
      // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
      const res = await promise;
      this.notificationService.success(successmessage);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return res;
    } catch (e) {
      this.notificationService.error(failedMessage);
      console.error(e);
    }
  }
}
