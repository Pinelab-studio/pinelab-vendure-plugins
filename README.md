[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

# Pinelab Vendure plugins

### Visit [pinelab-plugins.com](https://pinelab-plugins.com/) for official docs and examples.

# Development

Contributions welcome! [Check out our Contribution guidelines](./CONTRIBUTING.md)

## Upgrading Vendure version

Follow these steps to upgrade the vendure version of all plugins at once.

1. Create and checkout a new branch like `feat/vendure-1.7.1`
2. Upgrade all Vendure dependencies by running `yarn upgrade:vendure`
3. Create a PR to merge into `master`

## Create a new plugin

1. `cd packages`
2. `wget https://github.com/vendure-ecommerce/plugin-template/archive/refs/heads/master.zip`
3. `unzip master.zip`
4. `rm master.zip`
5. Follow the README in `plugin-template-mater`
