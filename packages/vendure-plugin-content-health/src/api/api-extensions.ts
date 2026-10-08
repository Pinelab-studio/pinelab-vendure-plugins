import { gql } from 'graphql-tag';

export const adminApiExtensions = gql`
  enum ContentCheckSeverity {
    WARNING
    ERROR
  }

  type ContentCheckMessage {
    source: String!
    severity: ContentCheckSeverity!
    code: String!
    message: String!
  }

  """
  \`entityType\` is 'PRODUCT'/'COLLECTION' for the built-in scan pipeline, or
  whatever free-form string an \`additionalChecks\` function chose for a
  custom entity (e.g. 'cms-content-entry').
  """
  type ContentCheckResult {
    id: ID!
    entityType: String!
    "Not the ID scalar, deliberately: see the resolver's decodeEntityId/encodeEntityId for why."
    entityId: String!
    languageCode: LanguageCode!
    url: String
    "Only set for custom entity types (see entityType); product/collection names are always resolved live instead."
    label: String
    hasError: Boolean!
    hasWarning: Boolean!
    messages: [ContentCheckMessage!]!
    checkedAt: DateTime!
  }

  """
  One row per entity (deduplicated across every language it was checked in,
  within the active channel) that currently has at least one warning or
  error in any of those languages.
  """
  type ContentCheckOverviewItem implements Node {
    id: ID!
    entityType: String!
    entityId: String!
    name: String!
    "The URL to link to for this entity. Always set for products/collections; only set for a custom entity type if its check provided one."
    url: String
    hasError: Boolean!
    hasWarning: Boolean!
    errorCount: Int!
    warningCount: Int!
    languageCodes: [LanguageCode!]!
    "The first error message if any, otherwise the first warning message."
    preview: String
  }

  type ContentCheckOverviewList implements PaginatedList {
    items: [ContentCheckOverviewItem!]!
    totalItems: Int!
  }

  input ContentCheckOverviewFilterParameter {
    name: StringOperators
    entityType: StringOperators
    hasError: BooleanOperators
    hasWarning: BooleanOperators
  }

  input ContentCheckOverviewListOptions {
    skip: Int
    take: Int
    filter: ContentCheckOverviewFilterParameter
    filterOperator: LogicalOperator
    sort: JSON
  }

  type ContentHealthScanResult {
    channelsScanned: Int!
    entitiesChecked: Int!
  }

  extend type Query {
    "Latest check results for a single entity, scoped to the active channel, across every language it was checked in."
    contentCheckResults(
      entityType: String!
      entityId: String!
    ): [ContentCheckResult!]!
    "Every entity in the active channel that currently has at least one warning or error, in any checked language."
    contentCheckOverview(
      options: ContentCheckOverviewListOptions
    ): ContentCheckOverviewList!
    "Every distinct entityType (built-in or from additionalChecks) that currently has at least one entity with a warning or error in the active channel — used to populate the issues list's type filter."
    contentCheckEntityTypes: [String!]!
  }

  extend type Mutation {
    "Manually re-checks a single product now, across all of its resolved channel/language combinations. Returns its fresh results for the active channel."
    runContentCheckForProduct(productId: ID!): [ContentCheckResult!]!
    "Manually re-checks a single collection now, across all of its resolved channel/language combinations. Returns its fresh results for the active channel."
    runContentCheckForCollection(collectionId: ID!): [ContentCheckResult!]!
    "Manually runs a full content/SEO scan now, the same as the scheduled task."
    runContentHealthFullScan: ContentHealthScanResult!
  }
`;
