import { NgModule } from '@angular/core';
import {
  addNavMenuItem,
  SharedModule,
  addActionBarItem,
  getServerLocation,
  LocalStorageService,
  registerBulkAction,
} from '@vendure/admin-ui/core';
import { gql } from 'graphql-tag';
import { firstValueFrom } from 'rxjs';
import { downloadBlob, getHeaders } from './helpers';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'picklists',
        label: 'Picklists',
        routerLink: ['/extensions/picklists'],
        icon: 'file-group',
        requiresPermission: 'AllowPicklistPermission',
      },
      'settings'
    ),
    addActionBarItem({
      id: 'download-picklist',
      label: 'Download picklist',
      locationId: 'customer-detail',
      requiresPermission: 'AllowPicklistPermission',
      onClick: async (event, context) => {
        (event.target as HTMLButtonElement).disabled = true;
        const customerId = context.route.snapshot.paramMap.get('id');
        const localStorageService = context.injector.get(LocalStorageService);
        const headers = getHeaders(localStorageService);
        const serverPath = getServerLocation();
        const res = await fetch(
          `${serverPath}/picklists/download/${customerId}`,
          {
            headers,
            method: 'GET',
          }
        );
        if (!res.ok) {
          const json = await res.json();
          (event.target as HTMLButtonElement).disabled = false;
          throw Error(json?.message);
        }
        const blob = await res.blob();
        const fileName = `customer-${customerId}.pdf`;
        await downloadBlob(blob, fileName, true);
        (event.target as HTMLButtonElement).disabled = false;
      },
    }),
  ],
})
export class PicklistNavModule {}
