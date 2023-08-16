import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { SchedulesComponent } from './schedules-component/schedules.component';
import { PaymentsComponent } from './payments-component/payments.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: 'subscription-schedules',
        component: SchedulesComponent,
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
  declarations: [SchedulesComponent, PaymentsComponent],
})
export class SchedulesModule {}
