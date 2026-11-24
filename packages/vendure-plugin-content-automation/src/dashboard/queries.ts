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

export const productContentAutomationStrategiesDocument = graphql(`
  query ProductContentAutomationStrategies {
    productContentAutomationStrategies
  }
`);

export const runContentAutomationStrategyForProductDocument = graphql(`
  mutation RunContentAutomationStrategyForProduct($productId: ID!, $strategyName: String!) {
    runContentAutomationStrategyForProduct(productId: $productId, strategyName: $strategyName) {
      languageCode
      generated
      resultMessage
    }
  }
`);
