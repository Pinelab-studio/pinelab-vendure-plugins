![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-e-boekhouden/dev/@vendure/core)

# Vendure E-boekhouden plugin

Plugin voor Dutch accounting platform E-boekhouden.nl.

## Plugin setup

### Vendure config

Add this to your plugin in `vendure-config.ts`:

```js
plugins: [
  ...
    EboekhoudenPlugin
  ...
]
```

### Database migration

Run a database migration to add the config entity to your database.

### Admin UI

Add this plugin to your Admin UI and compile.

```js
compileUiExtensions({
  outputPath: path.join(__dirname, '__admin-ui'),
  extensions: [
    ...
      EboekhoudenPlugin.ui,
    ...
  ]
```

Read more about Admin UI compilation in the Vendure
docs https://www.vendure.io/docs/plugins/extending-the-admin-ui/#compiling-as-a-deployment-step

### Credentials via Admin UI

Start the server and set your credentials via Settings > E-boekhouden

[![Pinelab.studio logo](https://pinelab.studio/img/pinelab-logo.png)](https://pinelab.studio)
