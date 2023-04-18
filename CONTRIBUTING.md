# Contributing to the Pinelab plugins

Below you can find our opinionated guide on how to contribute to this repository, and how we prefer to work at Pinelab.

## Gettings started

1. [Create a fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) of [this repository](https://github.com/Pinelab-studio/pinelab-vendure-plugins)
2. Checkout the `master` branch and make sure it's up to date with `git pull upstream master`
3. Create a feature branch `git checkout -b feat/example-feature`
4. `yarn` in the root of the project.
5. `cd packages/vendure-plugin-example` and `yarn` again to install it's dependencies
6. Commit using the commandline, so that the eslint autocheck is executed `git commit -a -m 'feat(feat/example-plugin): implemented example stuff'`

## Helpfull commands

- `yarn lint:check` to check if all files are formatted and linted correctly.
- `yarn lint:fix` Fix formatting and linting IN ALL PACKAGES. To just run in the package you've been working in use:
- `yarn lint --fix ./packages/test`
