import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';

@Component({
  selector: 'sendcloud-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <form class="form" [formGroup]="form">
          <section class="form-block">
            <vdr-form-field label="SendCloud secret" for="apiKey">
              <input id="secret" type="text" formControlName="secret" />
            </vdr-form-field>
            <vdr-form-field label="SendCloud public key" for="publicKey">
              <input id="publicKey" type="text" formControlName="publicKey" />
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
    });
  }

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(getMyparcelConfig)
      .mapStream((d: any) => d.myparcelConfig)
      .subscribe((config) =>
        this.form.controls['apiKey'].setValue(config.apiKey)
      );
  }

  async save(): Promise<void> {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        await this.dataService
          .mutate(updateMyparcelConfig, { input: { apiKey: formValue.apiKey } })
          .toPromise();
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'MyparcelConfig',
      });
    } catch (e) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'MyparcelConfig',
      });
    }
  }
}
