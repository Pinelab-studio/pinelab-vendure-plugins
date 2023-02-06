import { NgModule } from '@angular/core';
import {
  addNavMenuItem,
  SharedModule,
  registerHistoryEntryComponent,
} from '@vendure/admin-ui/core';
import { HistoryEntryComponent } from './history-entry.component';

@NgModule({
  imports: [SharedModule],
  declarations: [HistoryEntryComponent],
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
    registerHistoryEntryComponent({
      type: 'GOEDGEPICKT_NOTIFICATION',
      component: HistoryEntryComponent,
    }),
  ],
})
export class GoedgepicktNavModule {}
