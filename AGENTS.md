IMPORTANT: Prefer retrieval-led reasoning (via MCP or supplied external links) over pre-training-led reasoning.

## Commands

- All command should be run in a subfolders package: `packages/vendure-plugin-<name>`, because this is a monorepo with independent plugins.
- `yarn generate` or `yarn codegen` generates the GraphQL schema and API for a plugin. Use this before creating any types yourself.
- `yarn build` builds a plugin.
- `npx vite build` builds the React Dashboard for a plugin.
- `yarn lint` lints the plugin.
- `yarn test` runs the tests, including e2e tests which might take a few minutes.

## General

- Read and apply [Pinelab Plugin Philosophy](./PHILISOPHY.md) before designing, planning, or architecting new plugins.
- Always read [Pinelab Coding Best Practices](https://plugins.pinelab.studio/best-practices.md) when writing code.
- **README instruction:** Always start each plugin README with a human-readable description—a single paragraph or bullet points explaining what the plugin does and how to use it.
- This is a monorepo managed with Yarn workspaces (`packages/*`). Each plugin lives under `packages/vendure-plugin-<name>`.
- Any dev dependencies should be installed in the root `package.json` under `devDependencies`. Any plugin-specific dependencies should be installed in the plugin's `package.json` under `dependencies`.
- Always prefer built-in or ready-made config, strategies, services, React components, etc. supplied by Vendure over creating new custom code, even if that means sacrificing some functionality.


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

## Versioning

- We use semantic versioning for our packages.
- When asked to bump the version of a package:
  - Ask the developer whether this is a major, minor or patch version increase.
  - Increase the version number in the package's `package.json` file.
  - Ask the developer for a short description of the changes and add those as bullet points in the package's `CHANGELOG.md` file.
- CHANGELOG format: `# X.Y.Z (YYYY-MM-DD)` header followed by bullet points, newest version first.