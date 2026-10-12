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
