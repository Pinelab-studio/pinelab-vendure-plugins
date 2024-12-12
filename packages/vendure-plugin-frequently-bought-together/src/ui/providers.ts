import {
  addActionBarDropdownMenuItem,
  ModalService,
} from '@vendure/admin-ui/core';
import gql from 'graphql-tag';

export default [
  addActionBarDropdownMenuItem({
    id: 'generate-frequently-bought-together',
    label: 'Calculate frequently-bought-together relations',
    locationId: 'product-list',
    icon: 'switch',
    onClick: async (event, { dataService, notificationService, injector }) => {
      dataService
        .mutate(
          gql`
            mutation TriggerFrequentlyBoughtTogetherCalculation {
              triggerFrequentlyBoughtTogetherCalculation
            }
          `
        )
        .subscribe({
          next: () => {
            notificationService.success('Calculation triggered');
          },
          error: (err) => {
            notificationService.error(
              `Error starting calculation: ${err.message}`
            );
          },
        });
    },
  }),
];
