# Vendure Facets Suggestion Plugin

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-facet-suggestions)

The plugin adds a UI extenstion to the product detail page which implements the feature described in this [video](https://www.youtube.com/watch?v=nfIlBvbMcJ8).

## Getting started

Add the plugin to your `vendure-config.ts`:

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
