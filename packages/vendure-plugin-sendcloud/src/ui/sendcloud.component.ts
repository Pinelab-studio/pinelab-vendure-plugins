import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import { GET_SENDCLOUD_CONFIG, UPDATE_SENDCLOUD_CONFIG } from './queries';

@Component({
  selector: 'sendcloud-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <form [formGroup]="form" clrForm>
          <clr-input-container>
            <label>SendCloud secret</label>
            <input
              id="secret"
              type="text"
              formControlName="secret"
              clrInput
              size="28"
            />
          </clr-input-container>
          <clr-input-container>
            <label>SendCloud public key</label>
            <input
              id="publicKey"
              type="text"
              formControlName="publicKey"
              clrInput
              size="28"
            />
          </clr-input-container>
          <clr-input-container>
            <label>Fallback phone nr.</label>
            <input
              id="defaultPhoneNr"
              type="text"
              formControlName="defaultPhoneNr"
              clrInput
              size="28"
            />
            <clr-control-helper
              >Used when a customer hasn't entered a phone number. <br />
              Phone number is required in some cases by
              Sendcloud</clr-control-helper
            >
          </clr-input-container>
          <button
            class="btn btn-primary"
            (click)="save()"
            style="margin-left: 20rem"
            [disabled]="form.invalid || form.pristine"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  `,
})
export class SendcloudComponent implements OnInit {
  form: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    this.form = this.formBuilder.group({
      secret: ['your-secret'],
      publicKey: ['your-public-key'],
      defaultPhoneNr: ['your-phone-number'],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(GET_SENDCLOUD_CONFIG)
      .mapStream((d: any) => d.sendCloudConfig)
      .subscribe((config) => {
        this.form.controls['secret'].setValue(config.secret);
        this.form.controls['publicKey'].setValue(config.publicKey);
        this.form.controls['defaultPhoneNr'].setValue(config.defaultPhoneNr);
      });
  }

  async save(): Promise<void> {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        await this.dataService
          .mutate(UPDATE_SENDCLOUD_CONFIG, {
            input: {
              secret: formValue.secret,
              publicKey: formValue.publicKey,
              defaultPhoneNr: formValue.defaultPhoneNr,
            },
          })
          .toPromise();
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'SendCloud config',
      });
    } catch (e: any) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'SendCloud config',
      });
    }
  }
}
