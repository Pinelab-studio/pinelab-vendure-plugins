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
        <form class="form" [formGroup]="form">
          <section class="form-block">
            <vdr-form-field label="Shipmate apikey" for="apiKey">
              <input id="apiKey" type="text" formControlName="apiKey" />
            </vdr-form-field>
            <vdr-form-field label="Shipmate username" for="username">
              <input id="username" type="text" formControlName="username" />
            </vdr-form-field>
            <vdr-form-field label="Shipmate password" for="password">
              <vdr-password-form-input
                formControlName="password"
              ></vdr-password-form-input>
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
                        <vdr-password-form-input
                          [formControlName]="i"
                        ></vdr-password-form-input>
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
            <button
              class="btn btn-primary"
              (click)="save()"
              [disabled]="form.invalid || form.pristine"
            >
              Save
            </button>
          </section>
        </form>
      </div>
    </div>
  `,
  standalone: true,
  imports: [SharedModule],
})
export class ShipmateComponent implements OnInit {
  form: FormGroup;
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

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(getShipmateConfig)
      .mapStream((d: any) => d.shipmateConfig)
      .subscribe((config) => {
        this.form.controls['apiKey'].setValue(config.apiKey);
        this.form.controls['username'].setValue(config.username);
        this.form.controls['password'].setValue(config.password);
        for (let authTokenIndex in config.webhookAuthTokens ?? []) {
          const authToken = config.webhookAuthTokens[authTokenIndex];
          (this.form.controls['webhookAuthTokens'] as FormArray).setControl(
            parseInt(authTokenIndex),
            new FormControl([authToken])
          );
        }
        if (!config.webhookAuthTokens?.length) {
          (this.form.controls['webhookAuthTokens'] as FormArray).setControl(
            0,
            new FormControl([''])
          );
        }
      });
  }

  addAuthToken() {
    const webhookAuthTokensFormArray = this.form.controls[
      'webhookAuthTokens'
    ] as FormArray;
    webhookAuthTokensFormArray.setControl(
      webhookAuthTokensFormArray.length,
      new FormControl([''])
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
      if (this.form.dirty) {
        const formValue = this.form.value;
        await firstValueFrom(
          this.dataService.mutate(updateShipmateConfig, {
            input: {
              apiKey: formValue.apiKey,
              username: formValue.username,
              password: formValue.password,
              webhookAuthTokens: formValue.webhookAuthTokens,
            },
          })
        );
      }
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
