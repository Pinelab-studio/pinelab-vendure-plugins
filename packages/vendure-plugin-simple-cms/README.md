# Vendure Simple CMS Plugin

The goal of this plugin is to provide simple content management within Vendure. It is **not** intended as a page builder or drag-and-drop editor, but instead allows you to define structured content types such as a `Hero title, image and text` block, `Blog posts`, or other simple content entities. It can be seen as a kind of mini, simplified version of Directus.

Configuration of content types is similar to how custom fields are defined in Vendure itself: you specify which fields are available for each type of content (e.g., string, number, boolean, relation, or struct fields), and can indicate which fields are translatable.

This keeps things flexible and familiar for Vendure developers, focused on structured content rather than complex layouts or design tools.

Features:

- Pre-defined content types
- Translatable fields
- Relation, struct and primitive fields
- Content entries
- Content entry translations

## Getting Started

Install the plugin along with your own content types:

```ts
import { Asset, Product } from '@vendure/core';
import { SimpleCmsPlugin } from '@pinelab/vendure-plugin-simple-cms';

SimpleCmsPlugin.init({
  contentTypes: {
    // A single Hero block, edited as one entry
    hero: {
      displayName: 'Hero',
      allowMultiple: false,
      fields: [
        { name: 'title', type: 'string', isTranslatable: true },
        {
          name: 'subtitle',
          type: 'string',
          isTranslatable: true,
          nullable: true,
        },
        {
          name: 'image',
          type: 'relation',
          entity: Asset,
          graphQLType: 'Asset',
        },
      ],
    },

    // Multiple blog posts, with translatable body and a featured product
    blogPost: {
      displayName: 'Blog post',
      allowMultiple: true,
      fields: [
        { name: 'title', type: 'string', isTranslatable: true },
        { name: 'slug', type: 'string', isTranslatable: false },
        { name: 'body', type: 'text', isTranslatable: true },
        {
          name: 'publishedAt',
          type: 'date',
          isTranslatable: false,
          nullable: true,
        },
        {
          name: 'featured',
          type: 'boolean',
          isTranslatable: false,
          nullable: true,
        },
        {
          name: 'featuredProduct',
          type: 'relation',
          entity: Product,
          graphQLType: 'Product',
          nullable: true,
        },
        // Nested struct: list of CTA links
        {
          name: 'cta',
          type: 'struct',
          isTranslatable: true,
          fields: [
            { name: 'label', type: 'string' },
            { name: 'url', type: 'string' },
          ],
        },
      ],
    },
  },
});
```

Field types reference:

- `string`, `text`, `int`, `float`, `boolean`, `date` — primitives
- `relation` — references another Vendure entity (`Asset`, `Product`, `ProductVariant`, …)
- `struct` — nested object containing primitive sub-fields

Set `isTranslatable: true` on any primitive or struct field to store a value per language. A struct is translatable as a whole — its sub-fields cannot individually opt in or out.
Set `allowMultiple: false` to enforce a single entry per channel (singletons like a Hero or Footer).

## TODO

- Relation saving and fetching: Saving seems to work, but on refresh no relation is shown
