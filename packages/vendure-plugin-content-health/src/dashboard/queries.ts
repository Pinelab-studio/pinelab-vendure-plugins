import { graphql } from '@/gql';

export const contentCheckResultsDocument = graphql(`
  query ContentCheckResultsForBlock($entityType: String!, $entityId: String!) {
    contentCheckResults(entityType: $entityType, entityId: $entityId) {
      id
      languageCode
      url
      label
      hasError
      hasWarning
      messages {
        source
        severity
        code
        message
      }
    }
  }
`);

export const contentCheckOverviewListDocument = graphql(`
  query ContentCheckOverviewList($options: ContentCheckOverviewListOptions) {
    contentCheckOverview(options: $options) {
      items {
        id
        entityType
        entityId
        name
        url
        hasError
        hasWarning
        errorCount
        warningCount
        languageCodes
        preview
      }
      totalItems
    }
  }
`);

export const contentCheckOverviewForWidgetDocument = graphql(`
  query ContentCheckOverviewForWidget(
    $options: ContentCheckOverviewListOptions
  ) {
    contentCheckOverview(options: $options) {
      items {
        id
        entityType
        entityId
        name
        url
        hasError
        hasWarning
      }
      totalItems
    }
  }
`);

export const contentCheckOverviewForAlertDocument = graphql(`
  query ContentCheckOverviewForAlert(
    $options: ContentCheckOverviewListOptions
  ) {
    contentCheckOverview(options: $options) {
      items {
        entityType
        entityId
        name
        hasError
      }
      totalItems
    }
  }
`);

export const contentCheckEntityTypesDocument = graphql(`
  query ContentCheckEntityTypes {
    contentCheckEntityTypes
  }
`);

export const runContentCheckForProductDocument = graphql(`
  mutation RunContentCheckForProduct($productId: ID!) {
    runContentCheckForProduct(productId: $productId) {
      id
    }
  }
`);

export const runContentCheckForCollectionDocument = graphql(`
  mutation RunContentCheckForCollection($collectionId: ID!) {
    runContentCheckForCollection(collectionId: $collectionId) {
      id
    }
  }
`);

export const runContentHealthFullScanDocument = graphql(`
  mutation RunContentHealthFullScan {
    runContentHealthFullScan {
      channelsScanned
      entitiesChecked
    }
  }
`);
