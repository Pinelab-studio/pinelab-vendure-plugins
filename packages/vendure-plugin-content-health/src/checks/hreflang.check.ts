import { ContentCheckMessage } from '../types';
import { HreflangTag } from './html-extraction';

export interface HreflangCheckArgs {
  /** The resolved storefront URL of the page being checked. */
  pageUrl: string;
  /** The hreflang tags found on the page being checked. */
  hreflangTags: HreflangTag[];
  /** The channel's enabled language codes. */
  enabledLanguageCodes: string[];
  /**
   * The hreflang tags found on each page linked to from `hreflangTags`
   * (excluding `x-default` and self-references), keyed by href.
   * `undefined` means that linked page could not be fetched/parsed.
   */
  linkedPageTags: Map<string, HreflangTag[] | undefined>;
}

/**
 * @description
 * Validates hreflang completeness (every enabled language represented),
 * reciprocity (linked pages link back), and the presence of `x-default`.
 * Every violation is a warning; hreflang never produces errors.
 */
export function checkHreflang(args: HreflangCheckArgs): ContentCheckMessage[] {
  const { pageUrl, hreflangTags, enabledLanguageCodes, linkedPageTags } = args;
  const messages: ContentCheckMessage[] = [];

  // hreflang values are case-insensitive per BCP47, so tags and enabled
  // language codes are matched in lowercase to avoid false "missing
  // language" warnings for a storefront that renders e.g. `hreflang="EN"`.
  const hrefByLanguage = new Map<string, string>();
  let hasXDefault = false;
  for (const tag of hreflangTags) {
    if (tag.hreflang.toLowerCase() === 'x-default') {
      hasXDefault = true;
    } else {
      hrefByLanguage.set(tag.hreflang.toLowerCase(), tag.href);
    }
  }

  for (const languageCode of enabledLanguageCodes) {
    if (!hrefByLanguage.has(languageCode.toLowerCase())) {
      messages.push({
        source: 'hreflang',
        severity: 'warning',
        code: 'HREFLANG_MISSING_LANGUAGE',
        message: `Hreflang tags are missing an entry for enabled language '${languageCode}'.`,
      });
    }
  }

  if (!hasXDefault) {
    messages.push({
      source: 'hreflang',
      severity: 'warning',
      code: 'HREFLANG_MISSING_X_DEFAULT',
      message: `Hreflang tags are missing the required 'x-default' entry.`,
    });
  }

  for (const [languageCode, href] of hrefByLanguage) {
    if (href === pageUrl) {
      // Self-reference is trivially reciprocal.
      continue;
    }
    const linkedTags = linkedPageTags.get(href);
    const linksBack = linkedTags?.some((tag) => tag.href === pageUrl) ?? false;
    if (!linksBack) {
      messages.push({
        source: 'hreflang',
        severity: 'warning',
        code: 'HREFLANG_NOT_RECIPROCAL',
        message: `The hreflang link to '${href}' (${languageCode}) is not reciprocal: that page does not link back to '${pageUrl}'.`,
      });
    }
  }

  return messages;
}
