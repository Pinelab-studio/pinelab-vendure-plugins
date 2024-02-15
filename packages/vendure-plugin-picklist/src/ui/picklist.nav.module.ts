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
      locationId: 'order-detail',
      requiresPermission: 'AllowPicklistPermission',
      onClick: async (event, context) => {
        (event.target as HTMLButtonElement).disabled = true;
        const orderId = context.route.snapshot.paramMap.get('id');
        const response: any = await firstValueFrom(
          context.dataService.query(
            gql`
              query GetOrderCode($id: ID!) {
                order(id: $id) {
                  code
                }
              }
            `,
            { id: orderId }
          ).single$
        );
        const orderCode = response.order.code;
        const localStorageService = context.injector.get(LocalStorageService);
        const headers = getHeaders(localStorageService);
        const serverPath = getServerLocation();
        const res = await fetch(
          `${serverPath}/picklists/download/${orderCode}`,
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
        const fileName = `${orderCode}.pdf`;
        await downloadBlob(blob, fileName, true);
        (event.target as HTMLButtonElement).disabled = false;
      },
    }),
    registerBulkAction({
      location: 'order-list',
      label: 'Download picklists',
      icon: 'file-zip',
      onClick: async ({ injector, selection, route, event }) => {
        (event.target as HTMLButtonElement).disabled = true;
        const orderCodes = selection.map((s) => s.code);
        const localStorageService = injector.get(LocalStorageService);
        const headers = getHeaders(localStorageService);
        const serverPath = getServerLocation();
        const res = await fetch(
          `${serverPath}/picklists/download?orderCodes=${orderCodes}`,
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
        await downloadBlob(blob, 'picklists.zip');
        (event.target as HTMLButtonElement).disabled = false;
      },
    }),
  ],
})
export class PicklistNavModule {}
