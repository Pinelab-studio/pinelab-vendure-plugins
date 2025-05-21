/**
 * Convert date object to only the date part.
 */
export function toReadableDate(date?: Date): string | undefined {
  if (!date) {
    return '';
  }
  return date.toISOString().split('T')[0];
}
