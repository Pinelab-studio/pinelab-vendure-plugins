import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';

/**
 * This module adds the webhook-sections to existing nav
 */
@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'Myparcel',
        label: 'MyParcel',
        routerLink: ['/extensions/myparcel'],
        icon: 'bundle',
        requiresPermission: 'SetMyparcelConfig',
      },
      'settings'
    ),
  ],
})
export class MyparcelNavModule {}
