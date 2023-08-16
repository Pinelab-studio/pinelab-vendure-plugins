import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  DataService,
  ModalService,
  NotificationService,
} from '@vendure/admin-ui/core';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { DELETE_SCHEDULE, GET_SCHEDULES, UPSERT_SCHEDULES } from '../queries';
import {
  StripeSubscriptionSchedule,
  StripeSubscriptionSchedulesDocument,
  SubscriptionInterval,
  SubscriptionStartMoment,
} from '../generated/graphql';
import { TypedBaseListComponent } from '@vendure/admin-ui/core';

@Component({
  selector: 'stripe-subscription-component',
  styleUrls: ['./schedules.component.scss'],
  templateUrl: './schedules.component.html',
})
export class SchedulesComponent
  extends TypedBaseListComponent<
    typeof StripeSubscriptionSchedulesDocument,
    'stripeSubscriptionSchedules'
  >
  implements OnInit
{
  readonly filters: any = (
    this.createFilterCollection().addDateFilters() as any
  )
    .addFilters([
      {
        name: 'id',
        type: { kind: 'text' },
        label: _('common.id'),
        filterField: 'id',
      },
    ])
    .connectToRoute(this.route);
  readonly sorts: any = this.createSortCollection()
    .defaultSort('createdAt', 'DESC')
    .addSorts([
      { name: 'id' },
      { name: 'createdAt' },
      { name: 'updatedAt' },
      { name: 'name' },
      { name: 'downpayment' },
      { name: 'durationInterval' },
      { name: 'durationCount' },
      { name: 'startMoment' },
      { name: 'billingInterval' },
      { name: 'billingCount' },
      { name: 'paidUpFront' },
      { name: 'fixedStartDate' },
      { name: 'useProration' },
      { name: 'autoRenew' },
    ])
    .connectToRoute(this.route);
  schedules: StripeSubscriptionSchedule[] = [];
  selectedSchedule?: StripeSubscriptionSchedule;
  page = 1;
  itemsPerPage = 10;
  form: FormGroup;
  currencyCode!: string;
  intervals = [SubscriptionInterval.Week, SubscriptionInterval.Month];
  moments = [
    {
      name: 'First',
      value: SubscriptionStartMoment.StartOfBillingInterval,
    },
    {
      name: 'Last',
      value: SubscriptionStartMoment.EndOfBillingInterval,
    },
    {
      name: 'Time of purchase',
      value: SubscriptionStartMoment.TimeOfPurchase,
    },
    {
      name: 'Fixed date',
      value: SubscriptionStartMoment.FixedStartdate,
    },
  ];

  constructor(
    private formBuilder: FormBuilder,
    protected dataService: DataService,
    private changeDetector: ChangeDetectorRef,
    private notificationService: NotificationService,
    private modalService: ModalService
  ) {
    super();
    this.form = this.formBuilder.group({
      name: ['name', Validators.required],
      isPaidUpFront: [false],
      downpayment: [0, Validators.required],
      durationInterval: ['durationInterval', Validators.required],
      durationCount: ['durationCount', Validators.required],
      startMoment: ['startMoment', Validators.required],
      billingInterval: ['billingInterval', Validators.required],
      billingCount: ['billingCount', Validators.required],
      fixedStartDate: ['fixedStartDate'],
      useProration: [false],
      autoRenew: [true],
    });
    this.configure({
      document: StripeSubscriptionSchedulesDocument,
      getItems: (data) => data.stripeSubscriptionSchedules,
      setVariables: (skip, take) =>
        ({
          options: {
            skip,
            take,
            filter: {
              name: {
                contains: this.searchTermControl.value,
              },
              ...this.filters.createFilterInput(),
            },
            sort: this.sorts.createSortInput() as any,
          },
        } as any),
      refreshListOnChanges: [
        this.sorts.valueChanges,
        this.filters.valueChanges,
      ],
    });
  }
  get now() {
    return new Date().toISOString();
  }

  closeDetail() {
    this.selectedSchedule = undefined;
  }

  async ngOnInit(): Promise<void> {
    // await this.fetchSchedules();
    super.ngOnInit();
    this.dataService.settings.getActiveChannel().single$.subscribe((data) => {
      this.currencyCode = data.activeChannel.defaultCurrencyCode;
    });
  }

  selectDurationInterval(interval: 'week' | 'month') {
    this.form.controls['durationInterval'].setValue(interval);
  }

  selectBillingInterval(interval: 'week' | 'month') {
    this.form.controls['billingInterval'].setValue(interval);
  }

  edit(scheduleId: string): void {
    this.items$.subscribe((schedules) => {
      this.selectedSchedule = schedules.find((s) => s.id === scheduleId) as any;
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
      this.form.controls['isPaidUpFront'].setValue(
        this.selectedSchedule.paidUpFront
      );
      this.form.controls['fixedStartDate'].setValue(
        this.selectedSchedule.fixedStartDate
      );
      this.form.controls['useProration'].setValue(
        this.selectedSchedule.useProration
      );
      this.form.controls['autoRenew'].setValue(this.selectedSchedule.autoRenew);
    });
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
    this.form.controls['billingCount'].setValue(
      this.selectedSchedule.billingCount
    );
    this.form.controls['fixedStartDate'].setValue(undefined);
  }

  async save(): Promise<void> {
    try {
      if (this.form.dirty) {
        const formValue = this.form.value;
        if (formValue.isPaidUpFront) {
          formValue.downpayment = 0;
          // For paid up front duration and billing cycles are the same
          formValue.billingInterval = formValue.durationInterval;
          formValue.billingCount = formValue.durationCount;
        }
        if (formValue.startMoment === SubscriptionStartMoment.FixedStartdate) {
          formValue.useProration = false;
        }
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
              fixedStartDate: formValue.fixedStartDate,
              useProration: formValue.useProration,
              autoRenew: formValue.autoRenew,
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
      super.ngOnInit();
      this.selectedSchedule = undefined;
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
          await this.dataService
            .mutate(DELETE_SCHEDULE, { scheduleId })
            .toPromise();
          this.notificationService.success('Deleted schedule', {
            entity: 'Product',
          });
          this.selectedSchedule = undefined;
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
