import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'goedgepickt',
        label: 'Goedgepickt',
        routerLink: ['/extensions/goedgepickt'],
        icon: 'check',
        requiresPermission: 'SetGoedgepicktConfig',
      },
      'settings'
    ),
  ],
})
export class GoedgepicktNavModule {}
