# Contributing to the Pinelab plugins

The fastest way to get your bug fixed or feature released, is to create a Pull Request! After approval, we will publish your fix or feature as new version within 48 hours.

## Local development

1. Check out the repository.
2. `yarn` **in the root** of the project.
3. Go to the plugin you'd like to run. For example, `cd packages/vendure-plugin-stripe-webhook` and `yarn` again to install it's dependencies.
4. Run `yarn start` to start the plugin. This will start the plugin with a local SQLite database on localhost:3050.
5. Run `yarn test` to run the tests.
6. Run `yarn lint` to check+fix for linting errors.

## Development with the dashboard

1. In one terminal, run `yarn serve` (or `yarn start`) to start the Vendure server first.
2. In another terminal, run `yarn dev:dashboard` to start the dashboard in dev mode.
3. Go to `http://localhost:5173/dashboard` to view the dashboard.

If your dashboard keeps loading forever in the browser, you might need to access the dashboard in a private window.

## Creating a Pull Request

1. [Create a fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) of [this repository](https://github.com/Pinelab-studio/pinelab-vendure-plugins)
2. Checkout the `main` branch and make sure it's up to date with `git pull upstream main`
3. Create a feature branch `git checkout -b feat/example-feature`
4. Run the steps above, under "Local development", to start the plugin and test it.
5. Run `yarn build` and `yarn test` to check if everything works as expected, **before making any changes**.
6. Implement your changes.
7. Describe your changes in the `CHANGELOG.md` of the plugin.
8. Update the version number in `package.json`. This will make sure your changes are published as new version.
9. Commit using the commandline, so that the eslint auto fix is executed `git commit -a -m 'feat(stripe-subscription): implemented example stuff'`
10. Push the branch with `git push --set-upstream origin HEAD`
11. Create a Pull Request at https://github.com/Pinelab-studio/pinelab-vendure-plugins/pulls
