import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, NotificationService } from '@vendure/admin-ui/core';
import { getSchedules } from './queries';

@Component({
  selector: 'myparcel-component',
  template: `
    <div class="clr-row">
      <div class="clr-col">
        <form class="form">
          <section class="form-block">
            <p>FORMPIE</p>
          </section>
        </form>
      </div>
    </div>
  `,
})
export class SchedulesComponent implements OnInit {
  // form: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.dataService
      .query(getSchedules)
      .mapStream((result: any) => result.stripeSubscriptionSchedules)
      .subscribe((schedules) => console.log(schedules));
  }

  /*


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
      }*/
}
