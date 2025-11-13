# Vendure Facets Suggestion Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-facet-suggestions)

This plugin allows you to define facets that will show as suggestions on a product detail page. You can set facets to always show on every product detail, or dependant on other facet values.
This feature is based on one of [Michael Bromley's (Co-founder of Vendure) tutorials](https://www.youtube.com/watch?v=nfIlBvbMcJ8).

![image](https://plugins.pinelab.studio/plugin-images/facet-suggestions_product-detail.png)

## Getting started

1. Add the plugin to your `vendure-config.ts`:

```ts
    ...
     plugins: [
      FacetSuggestionsPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
        app: compileUiExtensions({
          outputPath: path.join(__dirname, '__admin-ui'),
          extensions: [FacetSuggestionsPlugin.ui],
        }),
      }),
    ...
     ]
     ...
```

2. Run a DB migration to add the new custom fields: https://docs.vendure.io/guides/developer-guide/migrations/#migration-workflow
3. Start the server and login to the admin UI and go to `facets`
4. On the facet detail page, check the box `Show on product detail page`
5. Update the facet
6. Go to a product detail page
7. You should now see a facet value selector for your facet right below the name/description block

There are two ways to show facets on the product detail page:

1. `Show on product detail page` - Always show for every product
2. `Show if product has facets` - Only show if a product already has selected facets. For example, you can use this to create product types: "If product has `category:laptop`, it should also have a facet value from the `memory` facet"
