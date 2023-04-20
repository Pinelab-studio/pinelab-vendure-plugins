import { DataService, OrderDetailFragment } from '@vendure/admin-ui/core';
import { take } from 'rxjs/operators';
import { gql } from 'graphql-tag';
import { ID } from '@vendure/core';

export async function createNewDraftOrder(
  dataService: DataService,
  oldOrderID: ID
): Promise<Boolean> {
  try {
    const result = await dataService
      .mutate(
        gql`
          mutation ConvertToDraft($id: ID) {
            convertToDraft(id: $id) {
              id
            }
          }
        `,
        { id: oldOrderID }
      )
      .pipe(take(1))
      .toPromise();
    return true;
  } catch (e) {
    return false;
  }
}
