import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'sendcloud',
        label: 'SendCloud',
        routerLink: ['/extensions/sendcloud'],
        icon: 'bundle',
        requiresPermission: 'SetSendCloudConfig',
      },
      'settings'
    ),
  ],
})
export class SendcloudNavModule {}
