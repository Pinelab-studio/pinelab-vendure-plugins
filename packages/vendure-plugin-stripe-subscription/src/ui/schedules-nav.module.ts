import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';
import { Permission } from '@vendure/core';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'stripe-subscription-schedules',
        label: 'Subscription schedules',
        routerLink: ['/extensions/subscription-schedules'],
        icon: 'script-schedule',
        requiresPermission: Permission.ReadSettings,
      },
      'settings'
    ),
  ],
})
export class SchedulesNavModule {}
