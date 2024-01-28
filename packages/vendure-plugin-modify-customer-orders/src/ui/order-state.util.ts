import { DataService, ORDER_DETAIL_FRAGMENT } from '@vendure/admin-ui/core';
import { take } from 'rxjs/operators';
import { gql } from 'graphql-tag';
import { ID } from '@vendure/core';
import { lastValueFrom } from 'rxjs';

export async function createNewDraftOrder(
  dataService: DataService,
  oldOrderID: ID
): Promise<Boolean> {
  await lastValueFrom(
    dataService
      .mutate(
        gql`
          mutation ConvertToDraft($id: ID!) {
            convertOrderToDraft(id: $id) {
              ... on Order {
                ...OrderDetail
              }
            }
          }
          ${ORDER_DETAIL_FRAGMENT}
        `,
        { id: oldOrderID }
      )
      .pipe(take(1))
  );
  return true;
}
