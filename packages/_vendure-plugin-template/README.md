# TEMPLATE

To create a new plugin inside this repo:

1. `cp -r packages/_vendure-plugin-template packages/vendure-plugin-<NAME>`
2. `cd packages/vendure-plugin-<NAME>` to make sure you are not making changes to the template.
3. Change the `name` and `description` in the `package.json` file.
4. Change `"private": true` to `"private": false` in the `package.json` file to enable publishing to NPM.
5. Setup this `README.md` file, starting with the URL below.
6. Set the correct date in the `CHANGELOG.md` file.
7. Find all `FIXME`'s in `src` and `test` and replace them with the correct information, usually just the plugin name.
8. `yarn` and `yarn start` should run the server on localhost:3050.
9. Use `npx vendure add` to add services, admin UI, api extensions etc.

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin- <NAME)
