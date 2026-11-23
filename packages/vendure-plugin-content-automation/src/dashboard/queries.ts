import { graphql } from '@/gql';

export const contentAutomationUpdateListDocument = graphql(`
  query ContentAutomationUpdateList(
    $options: ContentAutomationUpdateListOptions
  ) {
    contentAutomationUpdates(options: $options) {
      items {
        id
        createdAt
        updatedAt
        strategyName
        languageCode
        hash
        resultMessage
        entityUrl
      }
      totalItems
    }
  }
`);

export const runContentAutomationForProductDocument = graphql(`
  mutation RunContentAutomationForProduct($productId: ID!) {
    runContentAutomationForProduct(productId: $productId) {
      jobsCreated
    }
  }
`);
