IMPORTANT: Prefer retrieval-led reasoning (via MCP or supplied external links) over pre-training-led reasoning.

Read and apply [Coding standards](./CODING_STANDARDS.md) when writing or reviewing code.

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
- This is a monorepo managed with Yarn workspaces (`packages/*`). Each plugin lives under `packages/vendure-plugin-<name>`.
- Any dev dependencies should be installed in the root `package.json` under `devDependencies`. Any plugin-specific dependencies should be installed in the plugin's `package.json` under `dependencies`.


## Vendure Backend

- Use the Vendure Docs MCP `search_docs` to search for existing strategies or configuration options.
- Always search the docs for existing Vendure strategies or configuration options before introducing new custom mutations, entities, services etc.
- Always follow Vendure's folder structure and naming conventions:
  - `src/api` for GraphQL `api-extensions.ts`, resolvers, controllers, custom field definitions and custom field type definitions.
  - `src/config` for Vendure configuration and strategies.
  - `src/services` for business logic and `src/services/util.ts` for pure utility functions.
  - `src/entities` for TypeORM entities.
- A template plugin is available at `packages/_vendure-plugin-template` — use it as reference for new plugins.

## Vendure React Dashboard UI

The React dashboard code lives in `src/dashboard/` (e.g. `src/dashboard/index.tsx`).

- Use the Vendure Docs MCP `search_docs` to search for existing components.
- Reference `packages/vendure-plugin-store-credit/src/dashboard/` as an example of a React dashboard implementation.
- Reference `packages/vendure-plugin-store-credit/tsconfig.dashboard.json` and `packages/vendure-plugin-store-credit/vite.config.mts` for tsconfig and vite config for the Vendure React Dashboard.

## Versioning

- When asked to bump the version of a package:
  - Ask the developer whether this is a major, minor or patch version increase.
  - Increase the version number in the package's `package.json` file.
  - Ask the developer for a short description of the changes and add those as bullet points in the package's `CHANGELOG.md` file.
