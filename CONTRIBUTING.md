# Contributing to the Pinelab plugins

The fastest way to get your bug fixed or feature released, is to create a Pull Request! After approval, we will publish your fix or feature as new version within 48 hours.

## Gettings started

1. [Create a fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) of [this repository](https://github.com/Pinelab-studio/pinelab-vendure-plugins)
2. Checkout the `main` branch and make sure it's up to date with `git pull upstream main`
3. Create a feature branch `git checkout -b feat/example-feature`
4. `yarn` **in the root** of the project.
5. Go to the plugin for which you would like to create a fix. For example, `cd packages/vendure-plugin-stripe-subscription` and `yarn` again to install it's dependencies.
6. Run `yarn build` and `yarn test` to check if everything works as expected, **before making any changes**.
7. Implement your changes.
8. Describe your changes in the `CHANGELOG.md` of the plugin.
9. Update the version number in `package.json`. This will make sure your PR is published as new version.
10. Commit using the commandline, so that the eslint auto fix is executed `git commit -a -m 'feat(stripe-subscription): implemented example stuff'`
11. Push the branch with `git push --set-upstream origin HEAD`
12. Create a Pull Request at https://github.com/Pinelab-studio/pinelab-vendure-plugins/pulls

## Helpfull commands

- `yarn lint` Fix formatting and check linting in the current plugin.
