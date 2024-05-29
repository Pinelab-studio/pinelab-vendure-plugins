import { ID } from '@vendure/core';
import { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';

export async function updateCollectionParent(
  adminClient: SimpleGraphQLClient,
  id: ID,
  parentId: ID
): Promise<{ id: string; parent: { id: string } }> {
  const { updateCollection } = await adminClient.query(
    gql`
      mutation UpdateCollection($id: ID!, $parentId: ID) {
        updateCollection(input: { id: $id, parentId: $parentId }) {
          id
          parent {
            id
          }
        }
      }
    `,
    {
      id,
      parentId,
    }
  );
  return updateCollection;
}

export async function getRootCollection(
  adminClient: SimpleGraphQLClient
): Promise<{ id: string; customFields: { popularityScore: number } }> {
  const { collection: rootCollection } = await adminClient.query(
    gql`
      query GetRootCollection {
        collection(id: 1) {
          id
          customFields {
            popularityScore
          }
        }
      }
    `
  );
  return rootCollection;
}
