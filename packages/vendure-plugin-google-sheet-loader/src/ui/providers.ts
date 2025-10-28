import { addActionBarDropdownMenuItem } from '@vendure/admin-ui/core';
import gql from 'graphql-tag';

export default [
  addActionBarDropdownMenuItem({
    id: 'google-sheet-loader',
    label: 'Load Google Sheet data',
    locationId: 'product-list',
    icon: 'switch',
    requiresPermission: ['UpdateProduct'],
    onClick: (_, { dataService, notificationService }) => {
      dataService
        .mutate(
          gql`
            mutation LoadDataFromGoogleSheet {
              loadDataFromGoogleSheet
            }
          `
        )
        .subscribe({
          next: (r: any) => {
            notificationService.notify({
              message: `Loading data from Google Sheet...`,
              type: 'success',
              duration: 10000,
            });
          },
          error: (err) => {
            notificationService.notify({
              message: err.message,
              type: 'error',
              duration: 20000,
            });
          },
        });
    },
  }),
];
