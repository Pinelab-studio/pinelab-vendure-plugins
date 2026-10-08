import * as http from 'http';

export const MOCK_STOREFRONT_PORT = 3055;

function baseUrl(): string {
  return `http://localhost:${MOCK_STOREFRONT_PORT}`;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function hreflangLinks(kind: 'products' | 'collections', slug: string): string {
  const languages = ['en', 'nl'];
  const links = languages
    .map(
      (lang) =>
        `<link rel="alternate" hreflang="${lang}" href="${baseUrl()}/${lang}/${kind}/${slug}" />`
    )
    .join('\n    ');
  return `${links}\n    <link rel="alternate" hreflang="x-default" href="${baseUrl()}/en/${kind}/${slug}" />`;
}

function jsonLdScript(json: unknown[]): string {
  return `<script type="application/ld+json">${JSON.stringify(json)}</script>`;
}

function renderGoodPage(
  kind: 'products' | 'collections',
  slug: string
): string {
  const pageUrl = `${baseUrl()}/en/${kind}/${slug}`;
  const jsonLd =
    kind === 'products'
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: titleCase(slug),
            url: pageUrl,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'ProductGroup',
            name: titleCase(slug),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Demo Storefront',
          },
        ]
      : [
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [],
          },
        ];
  return `<!DOCTYPE html>
<html>
<head>
  <title>${titleCase(slug)} — a well-formed demo page title</title>
  <meta name="description" content="A meta description that is deliberately long enough to satisfy the recommended 140-160 character range for a healthy SEO score on this demo storefront page." />
  ${hreflangLinks(kind, slug)}
  ${jsonLdScript(jsonLd)}
</head>
<body>
  <h1>${titleCase(slug)}</h1>
</body>
</html>`;
}

/**
 * Deliberately broken page: too-short title, no meta description, no
 * hreflang tags, and no JSON-LD at all. Used to demonstrate every built-in
 * check firing at once — see the "Broken SEO Demo Product" seeded in
 * dev-server.ts (slug `broken-seo-demo`).
 */
function renderBrokenPage(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Broken</title>
</head>
<body>
  <h1>Broken</h1>
</body>
</html>`;
}

const sitemapIncludedUrls = new Set<string>();

/**
 * Starts a tiny local HTTP server that stands in for a real storefront and
 * its sitemap, so `yarn start` can demonstrate real fetch/redirect/JSON-LD/
 * hreflang behaviour without depending on an external site. Every
 * product/collection page is generated on the fly from the URL and
 * registered into an in-memory sitemap as soon as it is first fetched.
 */
export function startMockStorefrontServer(): Promise<void> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', baseUrl());
    const segments = url.pathname.split('/').filter(Boolean);

    if (
      segments.length === 3 &&
      (segments[1] === 'products' || segments[1] === 'collections')
    ) {
      const kind = segments[1] as 'products' | 'collections';
      const slug = segments[2];
      const pageUrl = url.toString();
      const isBroken = slug.includes('broken');
      // The broken demo page is deliberately excluded from the sitemap too,
      // so the sitemap-inclusion check also fails for it — otherwise, once
      // fetched once, it would silently start passing that check.
      if (!isBroken) {
        sitemapIncludedUrls.add(pageUrl);
      }
      const html = isBroken ? renderBrokenPage() : renderGoodPage(kind, slug);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    if (url.pathname === '/sitemap.xml') {
      const urls = [...sitemapIncludedUrls]
        .map((u) => `<url><loc>${u}</loc></url>`)
        .join('\n  ');
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n</urlset>`
      );
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve) => {
    server.listen(MOCK_STOREFRONT_PORT, () => resolve());
  });
}
