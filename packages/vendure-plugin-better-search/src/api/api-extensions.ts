import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  type SearchLogAggregate implements Node {
    id: ID!
    term: String!
    searchCount: Int!
    lastSearchedAt: DateTime!
    resultCount: Int!
    languageCode: LanguageCode!
  }

  type SearchLogAggregateList implements PaginatedList {
    items: [SearchLogAggregate!]!
    totalItems: Int!
  }

  input SearchLogAggregateListOptions {
    skip: Int
    take: Int
    sort: SearchLogAggregateSortParameter
    filter: SearchLogAggregateFilterParameter
    filterOperator: LogicalOperator
  }

  input SearchLogAggregateSortParameter {
    term: SortOrder
    searchCount: SortOrder
    lastSearchedAt: SortOrder
    resultCount: SortOrder
    languageCode: SortOrder
  }

  input SearchLogAggregateFilterParameter {
    term: StringOperators
    searchCount: NumberOperators
    lastSearchedAt: DateOperators
    resultCount: NumberOperators
    languageCode: StringOperators
    _and: [SearchLogAggregateFilterParameter!]
    _or: [SearchLogAggregateFilterParameter!]
  }

  extend type Query {
    searchLogAggregates(
      options: SearchLogAggregateListOptions
    ): SearchLogAggregateList!
    inspectSearchIndex(skip: Int, take: Int): JSON!
  }
`;

export const shopApiExtensions = gql`
  type SearchSuggestion {
    suggestion: String!
  }

  extend type Query {
    searchSuggestions(term: String!): [SearchSuggestion!]!
  }
`;
