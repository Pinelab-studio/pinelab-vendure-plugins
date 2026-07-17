import { Badge } from '@/vdb/components/ui/badge.js';

/**
 * A fixed palette of badge color classes (Tailwind). Each entry pairs
 * a background, text and border color so the badge is legible in both
 * light and dark modes.
 */
const COLOR_CLASSES: string[] = [
  'bg-yellow-200 text-yellow-900 border-yellow-300 dark:bg-yellow-800/60 dark:text-yellow-100 dark:border-yellow-700',
  'bg-green-200 text-green-900 border-green-300 dark:bg-green-800/60 dark:text-green-100 dark:border-green-700',
  'bg-teal-200 text-teal-900 border-teal-300 dark:bg-teal-800/60 dark:text-teal-100 dark:border-teal-700',
  'bg-sky-200 text-sky-900 border-sky-300 dark:bg-sky-800/60 dark:text-sky-100 dark:border-sky-700',
  'bg-blue-300 text-blue-950 border-blue-400 dark:bg-blue-700/60 dark:text-blue-50 dark:border-blue-600',
  'bg-indigo-300 text-indigo-950 border-indigo-400 dark:bg-indigo-700/60 dark:text-indigo-50 dark:border-indigo-600',
  'bg-violet-200 text-violet-900 border-violet-300 dark:bg-violet-800/60 dark:text-violet-100 dark:border-violet-700',
  'bg-stone-200 text-stone-900 border-stone-300 dark:bg-stone-700/60 dark:text-stone-100 dark:border-stone-600',
  'bg-lime-300 text-lime-950 border-lime-400 dark:bg-lime-700/60 dark:text-lime-50 dark:border-lime-600',
];

/**
 * Deterministic string hash (FNV-1a, 32-bit). Identical inputs always
 * yield the same numeric output — used here to pick a stable color
 * for a given content type code.
 */
function hashCode(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Picks a color class from {@link COLOR_CLASSES} based on a hash of
 * the given code, so the same code always renders with the same color.
 */
function colorClassForCode(code: string): string {
  const idx = hashCode(code) % COLOR_CLASSES.length;
  return COLOR_CLASSES[idx]!;
}

interface ContentTypeBadgeProps {
  code: string;
  label?: string;
}

/**
 * Renders a colored badge for a content type code. The color is
 * deterministically derived from the code, so each content type
 * always shows the same color across the dashboard.
 */
export function ContentTypeBadge({ code, label }: ContentTypeBadgeProps) {
  return (
    <Badge variant="outline" className={colorClassForCode(code)}>
      {label ?? code}
    </Badge>
  );
}
