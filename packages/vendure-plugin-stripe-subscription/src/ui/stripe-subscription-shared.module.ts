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
        id: 'subscription-schedules',
        label: 'Subscriptions schedules',
        routerLink: ['/extensions/stripe/subscription-schedules'],
        icon: 'calendar',
        requiresPermission: 'UpdateSettings',
      },
      'settings'
    ),
    addNavMenuItem(
      {
        id: 'subscription-payments',
        label: 'Subscriptions payments',
        routerLink: ['/extensions/stripe/subscription-payments'],
        icon: 'dollar',
        requiresPermission: 'UpdateSettings',
      },
      'settings'
    ),
  ],
})
export class StripeSubscriptionSharedModule {}
