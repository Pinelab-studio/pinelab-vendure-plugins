import { NgModule } from '@angular/core';
import {
  addNavMenuItem,
  registerHistoryEntryComponent,
  SharedModule,
} from '@vendure/admin-ui/core';
import { HistoryEntryComponent } from './history-entry.component';

@NgModule({
  imports: [SharedModule],
  declarations: [HistoryEntryComponent],
  providers: [
    addNavMenuItem(
      {
        id: 'sendcloud',
        label: 'SendCloud',
        routerLink: ['/extensions/sendcloud'],
        icon: 'cloud',
        requiresPermission: 'SetSendCloudConfig',
      },
      'settings'
    ),
    registerHistoryEntryComponent({
      type: 'SENDCLOUD_NOTIFICATION',
      component: HistoryEntryComponent,
    }),
  ],
})
export class SendcloudNavModule {}
