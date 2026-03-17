# vendure-plugin-simple-cms

## Goal

Provide a simple CMS plugin for Vendure that lets admins define content models and manage content entries in the dashboard, with content exposed through the Shop API. This plugin aims to minimize customization and stay close to the core Vendure functionality.

## Functional requirements

Consumers are consumers of the plugin, which are also developers. Administrators are users of the Vendure dashboard.

- Consumers can define custom content types in the plugin config
- Administrators can view a paginated list of all created content entries
- Administrators can search content entries by name or type
- Administrators can create new content entries for for a given content type
- Administrators can edit existing content entries
- Content entries are exposed through the Shop API
- Content entries are channel aware

# Implementation

## Guidelines

- Use Vendure's built-in features for custom functionality whenever possible:
  - Custom Entities: https://docs.vendure.io/current/core/developer-guide/database-entity
  - Translatable entities: https://docs.vendure.io/current/core/developer-guide/translatable
  - Channel Awareness: https://docs.vendure.io/current/core/developer-guide/channel-aware
  - Custom Fields: https://docs.vendure.io/current/core/developer-guide/custom-fields.
  - Reuse existing React Dashboard components: https://docs.vendure.io/current/core/extending-the-dashboard/custom-form-components/relation-selectors

## Custom content types

The plugin must allow consumers to define custom content types.
A content type defines:

- code
- display name
- allowMultiple: true or false. When true, multiple instances of this content type can be created. When false, only one instance of this content type can be created.
- fields: an array of fields

Example:

```ts
SimpleCmsPlugin.init({
  contentTypes: [
    {
      code: 'featured_product',
      displayName: [
        { languageCode: LanguageCode.en, value: 'Featured Product' },
      ],
      allowMultiple: false, // Only one instance of "Featured Product" can be created
      fields: [
        {
          name: 'title',
          type: 'localeString',
          label: [{ languageCode: LanguageCode.en, value: 'Title' }],
        },
        {
          name: 'image',
          type: 'relation',
          entity: Asset,
        },
      ],
    },
  ],
});
```

Available field types are coming from https://docs.vendure.io/current/core/developer-guide/custom-fields.

## Common GraphQL API Extensions

These are available to both Admin and Shop API.

```graphql
type ContentEntry {
  id: ID!
  code: String!
  name: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  contentTypeCode: String!
  fields: JSON!
}

type ContentEntryList {
  items: [ContentEntry!]!
  totalItems: Int!
}

input ContentEntryListOptions {
  skip: Int
  take: Int
  filter: ContentEntryListFilter
  filterOperator: LogicalOperator
  sort: JSON
}

extend type Query {
  contentEntries(input: ContentEntryListOptions): ContentEntryList!
  contentEntry(id: ID!): ContentEntry!
}
```

## Admin API extensions

```graphql
${commonSchemaExtensions}

input ContentEntryInput {
  code: String!
  name: String!
  contentTypeCode: String!
  fields: JSON!
}

extend type Mutation {
  createContentEntry(input: ContentEntryInput): ContentEntry!
  updateContentEntry(id: ID!, input: ContentEntryInput): ContentEntry!
  deleteContentEntry(id: ID!): ContentEntry!
}
```

The `fields` are appended at runtime based on the custom content type fields. For example if the custom content config is:

```ts
SimpleCmsPlugin.init({
  contentTypes: [
    {
      code: 'featured_product',
      displayName: [
        { languageCode: LanguageCode.en, value: 'Featured Product' },
      ],
      allowMultiple: false, // Only one instance of "Featured Product" can be created
      fields: [
        {
          name: 'title',
          type: 'localeString',
          label: [{ languageCode: LanguageCode.en, value: 'Title' }],
        },
        {
          name: 'image',
          type: 'relation',
          entity: Asset,
        },
      ],
    },
  ],
});
```

## React Dashboard

* The React dashboard will have a menu item "Content" under the "Catalog" section. https://docs.vendure.io/current/core/extending-the-dashboard/extending-overview
* This menu item will lead to a Content Entry Listing page. On this page admins can search and sort paginated content entries.
* When an entry from the list is clicked, the admin will be redirected to a Content Entry Detail page. On this page admins can view and edit the content entry.
* The top of the listing page will have a "create" button.
* Please reuse as much as possible from the Vendure source code: https://github.com/vendurehq/vendure/tree/master/packages/dashboard. Use the Github MCP to search through the code base.