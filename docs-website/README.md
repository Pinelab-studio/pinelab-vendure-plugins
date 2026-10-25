# Pinelab plugin documentation

An Astro Starlight site using the default theme, navigation, syntax highlighting, and Pagefind search.

## Development

Use Node 24 and Yarn Classic. Run commands from `docs-website/`, not the monorepo root:

```sh
corepack yarn install --frozen-lockfile
corepack yarn dev
```

Build and preview the production site (including search):

```sh
corepack yarn build
corepack yarn preview
```

The build emits a static site to `dist/`. Starlight handles the sitemap and Pagefind index; no server adapter is needed. Netlify should use `docs-website` as its base directory, `yarn build` as its command, and `dist` as its publish directory.

## Content

- Edit guides and site pages in `src/content/docs/`.
- Edit plugin README files, changelogs, and package metadata in their original `../packages/` directories, not in this website. The migration itself does not modify those packages.
- `scripts/generate-docs.ts` refreshes the gitignored `src/content/docs/plugin/` directory before every `dev` and `build`. These are disposable build inputs, not a second maintained source. Restart the dev command after editing a package source.
- Plugin URLs derive from their npm package names with the `@pinelab/` prefix removed, preserving the existing website's slugs. Plugin pages link to the full npm package name and changelog.
- Generated pages set edit links to the canonical package README/changelog on GitHub.
- LLM endpoints are intentionally not generated. `/ai-integration/` remains available with guidance on sharing documentation URLs.

## Design-system workbench

Open `/design-system/` on the dev server or production preview to compare all Starlight component families and their documented variations, plus a hero, in normal documentation context. Edit `src/content/docs/design-system.mdx` to adjust examples and `src/styles/pinelab.css` to change the shared site styling.

The workbench is hidden from navigation, Pagefind, and the sitemap, and has a `noindex, nofollow` robots tag. It is not private: anyone with its URL can open it. Use Starlight's theme picker to compare light and dark styles. The shared stylesheet customizes only Starlight's supported theme variables; components retain their default styling.

## Validation

No test suite is installed. Run the production build, compare `dist/` paths with the [live sitemap](https://plugins.pinelab.studio/sitemap-0.xml), and smoke-check representative plugin, changelog, guide, and AI integration pages. Review heading anchors and npm links as well as the homepage's `#plugins` section.

Use the production preview to check search, mobile navigation, theme switching, and the default 404 page. Pagefind search is indexed during the production build.

See [STARLIGHT-MIGRATION-PLAN.md](./STARLIGHT-MIGRATION-PLAN.md) for the migration scope and route contract.
