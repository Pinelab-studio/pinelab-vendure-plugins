import { NgModule } from '@angular/core';
import {
  addActionBarDropdownMenuItem,
  registerHistoryEntryComponent,
  SharedModule,
} from '@vendure/admin-ui/core';
import { HistoryEntryComponent } from './history-entry.component';
import gql from 'graphql-tag';

@NgModule({
  imports: [SharedModule],
  declarations: [HistoryEntryComponent],
  providers: [
    registerHistoryEntryComponent({
      type: 'GOEDGEPICKT_NOTIFICATION',
      component: HistoryEntryComponent,
    }),
    addActionBarDropdownMenuItem({
      id: 'gg-full-sync',
      label: 'GoedGepickt full sync',
      locationId: 'product-list',
      icon: 'refresh',
      onClick: async (
        event,
        { dataService, notificationService, injector }
      ) => {
        dataService
          .mutate(
            gql`
              mutation RunGoedgepicktFullSync {
                runGoedgepicktFullSync
              }
            `
          )
          .subscribe({
            next: () => {
              notificationService.success(
                'Started full sync. This might take about 15 minutes...'
              );
            },
            error: (err) => {
              notificationService.error(err.message);
            },
          });
      },
    }),
  ],
})
export class GoedgepicktNavModule {}
