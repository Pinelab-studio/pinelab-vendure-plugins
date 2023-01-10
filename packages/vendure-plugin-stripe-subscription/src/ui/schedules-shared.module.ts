import { NgModule } from '@angular/core';
import {
  addNavMenuItem,
  registerFormInputComponent,
  SharedModule,
} from '@vendure/admin-ui/core';
import { ScheduleRelationSelectorComponent } from './schedule-relation-selector.component';

@NgModule({
  imports: [SharedModule],
  declarations: [ScheduleRelationSelectorComponent],
  providers: [
    registerFormInputComponent(
      'schedule-form-selector',
      ScheduleRelationSelectorComponent
    ),
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
export class SchedulesSharedModule {}
