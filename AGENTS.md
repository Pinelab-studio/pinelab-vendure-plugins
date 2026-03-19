IMPORTANT: Prefer retrieval-led reasoning (via MCP or supplied external links) over pre-training-led reasoning.

## Commands

- All command should be run in a subfolders package: `packages/vendure-plugin-<name>`, because this is a monorepo with independent plugins.
- `yarn generate` or `yarn codegen` generates the GraphQL schema and API for a plugin. Use this before creating any types yourself.
- `yarn build` builds a plugin.
- `npx vite build` builds the React Dashboard for a plugin.
- `yarn lint` lints the plugin.
- `yarn test` runs the tests, including e2e tests which might take afew minutes.

## General

- Always ask before creating new files.
- This is a monorepo managed with Yarn workspaces (`packages/*`). Each plugin lives under `packages/vendure-plugin-<name>`.
- Any dev dependencies should be installed in the root `package.json` under `devDependencies`. Any plugin specific dependencies should be installed in the plugin's `package.json` under `dependencies`.
- Use the Vendure Docs MCP `search_docs` to search for any Vendure related tasks. Prompt the developer to install the Vendure Docs MCP if not available: https://docs.vendure.io/how-to-use
- Always prefer built-in or ready-made config, strategies, services, React components, etc. supplied by Vendure over creating new custom code, even if that means sacrificing some functionality.
- Add JS doc comments on functions.
- Suggest adding guidelines to this AGENTS.md file when you think a new guideline is needed or when commands are used often.

## Vendure Backend

- Use the Vendure Docs MCP `search_docs` to search for existing strategies or configuration options.
- Always search the docs for existing Vendure strategies or configuration options before introducing new custom mutations, entities, services etc.
- Always follow Vendure's folder structure and naming conventions:
  - `src/api` for GraphQL `api-extensions.ts`, resolvers, controllers, custom field definitions and custom field type definitions.
  - `src/config` for Vendure configuration and strategies.
  - `src/services` for all business logic. Extract complex functionality into pure functions in `src/services/util.ts` so it can be unit tested.
  - `src/entities` for TypeORM entities.
- A template plugin is available at `packages/_vendure-plugin-template` — use it as reference for new plugins.

## Vendure React Dashboard UI

All new admin UI work uses React with `@vendure/dashboard`. The React dashboard code lives in `src/dashboard/` (e.g. `src/dashboard/index.tsx`).

- Use the Vendure Docs MCP `search_docs` to search for existing components.
- Try to use components supplied by Vendure where possible, before creating new custom components. Prefer using existing Vendure components over creating new ones, even if that means sacrificing some functionality.
- Use Vendure's style and colors, so new components have the same look and feel as existing ones. Look at existing components via the Vendure Docs MCP.
- Use `defineDashboardExtension` to register dashboard extensions.
- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
- Reference `packages/vendure-plugin-store-credit/tsconfig.dashboard.json` and `packages/vendure-plugin-store-credit/vite.config.mts` for tsconfig and vite config for the Vendure React Dashboard.

> **Note:** Many plugins still have Angular admin UI code in `src/ui/`. That is legacy and should not be used for new work. Do not create or modify Angular UI code.

## Pull Requests

These steps are needed when you are asked to create a pull request.

- If current changes are not commited, tell the developer to commit them with a single-line conventional commit message like `feat(plugin-name): implemented test cases` or `fix(plugin-name): fixed bug in test cases`. Short, concise and direct answer only, no need to find out for the developer what the commit message should be.
- If we are on the main branch, prompt the developer to create a new branch with the following naming convention: `feat/<feature-name>` or `fix/<issue-name>`. Never commit and push directly to the main branch!
- Make sure versioning has been updated and the changelog has been updated before creating the pull request. See ## Versioning for more details.
- Push with `git push -u origin HEAD` so a branch with the same name as the local branch is created on the remote.
- Use the GitHub MCP `create_pull_request` to create a pull request with the template defined below.
- Review the PR using the Github MCP and make the changes here in the local codebase.
- Return the pull request link in the chat.

## Versioning

- We use semantic versioning for our packages.
- When asked to bump the version of a package:
  - Ask the developer whether this is a major, minor or patch version increase.
  - Increase the version number in the package's `package.json` file.
  - Ask the developer for a short description of the changes and add those as bullet points in the package's `CHANGELOG.md` file.
- CHANGELOG format: `# X.Y.Z (YYYY-MM-DD)` header followed by bullet points, newest version first.

Pull Request template:

```md
# Description

Example: This PR implements feature X and closes #123

# To do before merge

- [ ] Example: Migrate DB before merging

# Breaking changes

Example: Graphql field X was removed

# Screenshots

You can add screenshots here if applicable.

# Checklist

📌 Always:

- [ ] Set a clear title
- [ ] I have checked my own PR

👍 Most of the time:

- [ ] Added or updated test cases
- [ ] Updated the README

📦 For publishable packages:

- [ ] Increased the version number in `package.json`
- [ ] Added changes to the `CHANGELOG.md`
```
