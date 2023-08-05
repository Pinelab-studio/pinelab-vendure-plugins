import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { SchedulesComponent } from './schedules-component/schedules.component';
import { PaymentsComponent } from './payments-component/payments.component';
import { SchedulesComponent as Schedules2Component } from './schedules-component/schedules.component-2';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: 'subscription-schedules',
        component: Schedules2Component,
        data: { breadcrumb: 'Subscription schedules' },
      },
      {
        path: 'subscription-payments',
        component: PaymentsComponent,
        data: { breadcrumb: 'Subscription payments' },
      },
    ]),
  ],
  providers: [],
  declarations: [SchedulesComponent, PaymentsComponent, Schedules2Component],
})
export class SchedulesModule {}
