import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  DataService,
  ModalService,
  NotificationService,
} from '@vendure/admin-ui/core';
import { GET_SCHEDULES, UPSERT_SCHEDULES } from './queries';
import {
  StripeSubscriptionSchedule,
  SubscriptionInterval,
  SubscriptionStartMoment,
} from './generated/graphql';

@Component({
  selector: 'stripe-subscription-component',
  styleUrls: ['./schedules.component.scss'],
  template: `
    <h1>Stripe Subscription Schedules</h1>
    <p>
      Manage subscription schedules here. A schedule can be connected to a
      product variant to make it a subscription.
    </p>
    <br />
    <button class="btn btn-primary" (click)="newSchedule()">
      Create new schedule
    </button>
    <div class="stripe-schedules-wrapper">
      <vdr-data-table
        class="stripe-schedules-list"
        [items]="schedules"
        [itemsPerPage]="itemsPerPage"
        [totalItems]="schedules.length"
        [currentPage]="1"
        (pageChange)="setPageNumber($event)"
        (itemsPerPageChange)="setItemsPerPage($event)"
      >
        <ng-template let-schedule="item">
          <td class="left align-middle">{{ schedule.id }}</td>
          <td class="left align-middle">{{ schedule.name }}</td>
          <td class="left align-middle">
            {{ schedule.createdAt | date }}
          </td>
          <td class="left align-middle">
            <vdr-table-row-action
              iconShape="edit"
              [label]="'common.edit' | translate"
              (click)="edit(schedule.id)"
            ></vdr-table-row-action>
          </td>
          <td class="left align-middle">
            <vdr-table-row-action
              iconShape="trash"
              class="is-danger"
              (click)="deleteSchedule(schedule.id)"
            ></vdr-table-row-action>
          </td>
        </ng-template>
      </vdr-data-table>
      <div class="stripe-schedules-edit" [class.expanded]="selectedSchedule">
        <div class="contents-header">
          <div class="header-title-row">
            <h2>
              {{
                selectedSchedule?.id
                  ? 'Edit schedule ' + selectedSchedule?.id
                  : 'Create new schedule'
              }}
            </h2>
            <button type="button" class="close-button" (click)="closeEdit()">
              <clr-icon shape="close"></clr-icon>
            </button>
          </div>
        </div>
        <!------------------ Editing form ----------------->
        <form class="form" [formGroup]="form">
          <section class="form-block">
            <vdr-form-field label="Name" for="name">
              <input id="name" type="text" formControlName="name" />
            </vdr-form-field>
            <vdr-form-field label="The duration is" for="durationCount">
              <input
                class="count"
                id="durationCount"
                type="number"
                formControlName="durationCount"
              />
              <select
                clrSelect
                name="options"
                formControlName="durationInterval"
                required
              >
                <option *ngFor="let interval of intervals" [value]="interval">
                  {{ interval }}{{ form.value.durationCount > 1 ? 's' : '' }}
                </option>
              </select>
            </vdr-form-field>
            <!-- Billing ------------------->
            <vdr-form-field
              label="Billing will occur every "
              for="billingInterval"
            >
              <input
                class="count"
                id="billingCount"
                type="number"
                formControlName="billingCount"
              />
              <select
                clrSelect
                name="options"
                formControlName="billingInterval"
                required
              >
                <option *ngFor="let interval of intervals" [value]="interval">
                  {{ interval }}{{ form.value.billingCount > 1 ? 's' : '' }}
                </option>
              </select>
              <span>on the</span>
              <select
                clrSelect
                name="options"
                formControlName="startMoment"
                required
              >
                <option *ngFor="let moment of moments" [value]="moment.value">
                  {{ moment.name }}
                </option>
              </select>
              <span *ngIf="form.value.billingInterval === 'week'">
                day of the week
              </span>
              <span
                *ngIf="
                  form.value.billingInterval === 'month' &&
                  form.value.startMoment !== 'time_of_purchase'
                "
              >
                of the month
              </span>
            </vdr-form-field>
            <vdr-form-field
              label="Downpayment"
              for="billingInterval"
              tooltip="A downpayment requires a user to pay an amount up front. The prorated amount will be deducted from the monthly/weekly price"
            >
              <vdr-currency-input
                clrInput
                [currencyCode]="currencyCode"
                formControlName="downpayment"
              ></vdr-currency-input>
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
export class SchedulesComponent implements OnInit {
  schedules: StripeSubscriptionSchedule[] = [];
  selectedSchedule?: StripeSubscriptionSchedule;
  page = 1;
  itemsPerPage = 10;
  form: FormGroup;
  currencyCode!: string;
  intervals = [SubscriptionInterval.Week, SubscriptionInterval.Month];
  moments = [
    {
      name: 'first',
      value: SubscriptionStartMoment.StartOfBillingInterval,
    },
    {
      name: 'last',
      value: SubscriptionStartMoment.EndOfBillingInterval,
    },
    {
      name: 'time of purchase',
      value: SubscriptionStartMoment.TimeOfPurchase,
    },
  ];

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService,
    private modalService: ModalService
  ) {
    this.form = this.formBuilder.group({
      name: ['name', Validators.required],
      downpayment: ['downpayment', Validators.required],
      durationInterval: ['durationInterval', Validators.required],
      durationCount: ['durationCount', Validators.required],
      startMoment: ['startMoment', Validators.required],
      billingInterval: ['billingInterval', Validators.required],
      billingCount: ['billingCount', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.fetchSchedules();
    this.dataService.settings.getActiveChannel().single$.subscribe((data) => {
      this.currencyCode = data.activeChannel.currencyCode;
    });
  }

  selectDurationInterval(interval: 'week' | 'month') {
    this.form.controls['durationInterval'].setValue(interval);
  }

  selectBillingInterval(interval: 'week' | 'month') {
    this.form.controls['billingInterval'].setValue(interval);
  }

  edit(scheduleId: string): void {
    this.selectedSchedule = this.schedules.find((s) => s.id === scheduleId);
    if (!this.selectedSchedule) {
      return;
    }
    this.form.controls['name'].setValue(this.selectedSchedule.name);
    this.form.controls['downpayment'].setValue(
      this.selectedSchedule.downpayment
    );
    this.form.controls['durationInterval'].setValue(
      this.selectedSchedule.durationInterval
    );
    this.form.controls['durationCount'].setValue(
      this.selectedSchedule.durationCount
    );
    this.form.controls['startMoment'].setValue(
      this.selectedSchedule.startMoment
    );
    this.form.controls['billingInterval'].setValue(
      this.selectedSchedule.billingInterval
    );
    this.form.controls['billingCount'].setValue(
      this.selectedSchedule.billingCount
    );
  }

  newSchedule(): void {
    this.selectedSchedule = {
      name: 'New schedule',
      downpayment: 0,
      durationInterval: SubscriptionInterval.Month,
      durationCount: 6,
      startMoment: SubscriptionStartMoment.StartOfBillingInterval,
      billingInterval: SubscriptionInterval.Month,
      billingCount: 1,
    } as StripeSubscriptionSchedule;
    this.form.controls['name'].setValue(this.selectedSchedule.name);
    this.form.controls['downpayment'].setValue(
      this.selectedSchedule.downpayment
    );
    this.form.controls['durationInterval'].setValue(
      this.selectedSchedule.durationInterval
    );
    this.form.controls['durationCount'].setValue(
      this.selectedSchedule.durationCount
    );
    this.form.controls['startMoment'].setValue(
      this.selectedSchedule.startMoment
    );
    this.form.controls['billingInterval'].setValue(
      this.selectedSchedule.billingInterval
    );
    this.form.controls['billingCount'].setValue(
      this.selectedSchedule.billingCount
    );
  }

  async save(): Promise<void> {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        await this.dataService
          .mutate(UPSERT_SCHEDULES, {
            input: {
              id: this.selectedSchedule?.id,
              name: formValue.name,
              downpayment: formValue.downpayment,
              durationInterval: formValue.durationInterval,
              durationCount: formValue.durationCount,
              startMoment: formValue.startMoment,
              billingInterval: formValue.billingInterval,
              billingCount: formValue.billingCount,
            },
          })
          .toPromise();
      }
      this.form.markAsPristine();
      this.changeDetector.markForCheck();
      this.notificationService.success('common.notify-update-success', {
        entity: 'Schedule',
      });
    } catch (e) {
      this.notificationService.error('common.notify-update-error', {
        entity: 'Schedule',
      });
    } finally {
      this.fetchSchedules();
    }
  }

  deleteSchedule(scheduleId: string): void {
    this.modalService
      .dialog({
        title: 'Are you sure you want to delete this schedule?',
        buttons: [
          { type: 'secondary', label: 'Cancel' },
          { type: 'danger', label: 'Delete', returnValue: true },
        ],
      })
      .subscribe(async (confirm) => {
        if (confirm) {
          console.log('TODO delete');
          this.notificationService.success('Deleted schedule', {
            entity: 'Product',
          });
          await this.fetchSchedules();
        }
      });
  }

  closeEdit() {
    this.selectedSchedule = undefined;
  }

  async fetchSchedules(): Promise<void> {
    this.dataService
      .query(GET_SCHEDULES)
      .refetchOnChannelChange()
      .mapStream((result: any) => result.stripeSubscriptionSchedules)
      .subscribe((schedules) => {
        this.schedules = schedules.slice(
          (this.page - 1) * this.itemsPerPage,
          this.itemsPerPage
        );
      });
  }

  async setPageNumber(page: number) {
    this.page = page;
    await this.fetchSchedules();
  }

  async setItemsPerPage(nrOfItems: number) {
    this.page = 1;
    this.itemsPerPage = Number(nrOfItems);
    await this.fetchSchedules();
  }
}
