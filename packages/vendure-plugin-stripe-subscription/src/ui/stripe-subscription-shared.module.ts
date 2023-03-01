import { NgModule } from '@angular/core';
import {
  addNavMenuItem,
  registerFormInputComponent,
  registerHistoryEntryComponent,
  SharedModule,
} from '@vendure/admin-ui/core';
import { ScheduleRelationSelectorComponent } from './schedule-relation-selector.component';
import { HistoryEntryComponent } from './history-entry.component';

@NgModule({
  imports: [SharedModule],
  declarations: [ScheduleRelationSelectorComponent, HistoryEntryComponent],
  providers: [
    registerFormInputComponent(
      'schedule-form-selector',
      ScheduleRelationSelectorComponent
    ),
    registerHistoryEntryComponent({
      type: 'STRIPE_SUBSCRIPTION_NOTIFICATION',
      component: HistoryEntryComponent,
    }),
    addNavMenuItem(
      {
        id: 'stripe-subscription-schedules',
        label: 'Subscriptions',
        routerLink: ['/extensions/subscription-schedules'],
        icon: 'calendar',
        requiresPermission: 'UpdateSettings',
      },
      'settings'
    ),
  ],
})
export class StripeSubscriptionSharedModule {}
