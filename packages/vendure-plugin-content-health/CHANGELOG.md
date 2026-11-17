# 0.3.0 (2026-11-12)

- **BREAKING:** The meta title, meta description, hreflang and JSON-LD checks no longer run automatically. Pass a `validateStorefront` strategy, which receives the server-rendered HTML of each storefront page. To keep the 0.2.x checks, compose the exported helpers as shown in the README.
- Added `validateJsonLd()`, which also reports malformed JSON-LD blocks, `validateHreflang()` and `extractLinks()` helpers.
- `checks.product` and `checks.collection` functions now receive an `injector`.
- Added `fetchPage()` to the `validateStorefront` arguments, cached per channel during a full scan. Failed page fetches now include the HTTP `status` and `finalUrl`.

# 0.2.3 (2026-11-12)

- Show only the issue count in notifications, with a link to the issues list.
- Rename the menu item and page to "Content issues".
- Improve issue-list loading with batched entity lookups.

# 0.2.2 (2026-08-26)

- Fixed the content-check result composite index exceeding MySQL's maximum key length with utf8mb4.

# 0.2.1 (2026-08-21)

- Added a link to the official plugin documentation to the README.

# 0.2.0 (2026-08-10)

- Initial release: storefront/content SEO monitoring for products and collections, with scheduled and on-demand full scans, per-entity checks on update, a pluggable Vendure content check extension point, built-in meta title/description/hreflang/JSON-LD/sitemap checks, and a React Dashboard extension (findings block, overview widget, error alert).
