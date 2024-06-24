import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl } from '@angular/forms';
import {
  DataService,
  NotificationService,
  SharedModule,
} from '@vendure/admin-ui/core';
import { getShipmateConfig, updateShipmateConfig } from './queries';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'shipmate-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <form class="form" [formGroup]="form" *ngIf="dataHasLoaded">
          <section class="form-block">
            <vdr-form-field label="Shipmate apikey" for="apiKey">
              <input id="apiKey" type="text" formControlName="apiKey" />
            </vdr-form-field>
            <vdr-form-field label="Shipmate username" for="username">
              <input id="username" type="text" formControlName="username" />
            </vdr-form-field>
            <vdr-form-field label="Shipmate password" for="password">
              <input type="password" [formControl]="form.get('password')" />
            </vdr-form-field>
            <vdr-form-field label="Webhook auth tokens" for="webhookAuthToken">
              <table class="facet-values-list table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody formArrayName="webhookAuthTokens">
                  <ng-container
                    *ngFor="
                      let item of form.get('webhookAuthTokens')?.controls;
                      let i = index
                    "
                  >
                    <tr class="facet-value">
                      <td>
                        <input type="password" [formControlName]="i" />
                      </td>
                      <td class="align-middle">
                        <vdr-dropdown>
                          <button
                            type="button"
                            class="icon-button"
                            vdrDropdownTrigger
                          >
                            <clr-icon shape="ellipsis-vertical"></clr-icon>
                          </button>
                          <vdr-dropdown-menu vdrPosition="bottom-right">
                            <button
                              type="button"
                              class="delete-button"
                              (click)="deleteAuthToken(i)"
                              vdrDropdownItem
                            >
                              <clr-icon
                                shape="trash"
                                class="is-danger"
                              ></clr-icon>
                              {{ 'common.delete' | translate }}
                            </button>
                          </vdr-dropdown-menu>
                        </vdr-dropdown>
                      </td>
                    </tr>
                  </ng-container>
                </tbody>
                <div>
                  <button
                    type="button"
                    class="button m-3"
                    (click)="addAuthToken()"
                  >
                    <clr-icon shape="add"></clr-icon>
                    Add Token
                  </button>
                </div>
              </table>
            </vdr-form-field>
            <button class="btn btn-primary" (click)="save()">Save</button>
          </section>
        </form>
      </div>
    </div>
  `,
  standalone: true,
  imports: [SharedModule],
})
export class ShipmateComponent implements OnInit {
  // [disabled]="form.invalid || form.pristine"
  form: FormGroup;
  dataHasLoaded: boolean = false;
  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    this.form = this.formBuilder.group({
      apiKey: ['your-api-key'],
      username: [''],
      password: [''],
      webhookAuthTokens: new FormArray([]),
    });
  }

  ngOnInit(): void {
    this.dataService
      .query(getShipmateConfig)
      .refetchOnChannelChange()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      .mapStream((d: any) => d.shipmateConfig)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      .subscribe((config) => {
        if (config) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.form.controls['apiKey'].setValue(config.apiKey);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.form.controls['username'].setValue(config.username);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.form.controls['password'].setValue(config.password);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          for (const authTokenIndex in config.webhookAuthTokens ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const authToken = config.webhookAuthTokens[authTokenIndex].token;
            (this.form.controls['webhookAuthTokens'] as FormArray).setControl(
              parseInt(authTokenIndex),
              new FormControl(authToken)
            );
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (!config.webhookAuthTokens?.length) {
            (this.form.controls['webhookAuthTokens'] as FormArray).setControl(
              0,
              new FormControl('')
            );
          }
        }
        this.dataHasLoaded = true;
        this.changeDetector.markForCheck();
      });
  }

  addAuthToken() {
    const webhookAuthTokensFormArray = this.form.controls[
      'webhookAuthTokens'
    ] as FormArray;
    webhookAuthTokensFormArray.setControl(
      webhookAuthTokensFormArray.length,
      new FormControl('')
    );
    this.changeDetector.markForCheck();
  }

  deleteAuthToken(index: number) {
    const webhookAuthTokensFormArray = this.form.controls[
      'webhookAuthTokens'
    ] as FormArray;
    webhookAuthTokensFormArray.removeAt(index);
  }

  async save(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const formValue = this.form.value;
      await firstValueFrom(
        this.dataService.mutate(updateShipmateConfig, {
          input: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            apiKey: formValue.apiKey,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            username: formValue.username,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            password: formValue.password,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            webhookAuthTokens: formValue.webhookAuthTokens,
          },
        })
      );
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'ShipmateConfig',
      });
    } catch (e) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'ShipmateConfig',
      });
    }
  }
}
