[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

# Pinelab Vendure plugins

### Visit [pinelab-plugins.com](https://pinelab-plugins.com/) for official docs and examples.

# Development

Contributions welcome! [Check out our Contribution guidelines](./CONTRIBUTING.md)

1. `yarn` in the root of the repository will install all dependencies of each plugin (using yarn workspaces)
2. You can now `yarn build` and/or `yarn test` in each plugin

:warning: You might need to run `yarn add -D -W --ignore-engines sharp` in the root when you are seeing errors related to sharp during startup: `Could not load the "sharp" module using the linux-x64 runtime`.

## Upgrading Vendure version

Follow these steps to upgrade the vendure version of all plugins at once.

1. Create and checkout a new branch like `feat/vendure-1.7.1`
2. Upgrade all Vendure dependencies by running `yarn upgrade:vendure`
3. Create a PR to merge into `main`

## Create a new plugin

1. `cd packages`
2. `wget https://github.com/vendure-ecommerce/plugin-template/zipball/master.zip`
3. `unzip master`
4. `rm master`
5. Follow the README in `vendure-ecommerce-plugin-tempalte-xxxx`
