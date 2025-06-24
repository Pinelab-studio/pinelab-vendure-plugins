/**
 * Returns all suffixes and prefixes of a term
 *
 * This is used so that searching for "shop" also finds "webshop", because it ends with "shop".
 */
export function tokenize(term: string, minLength: number): string[] {
  if (term == null) return [];
  const tokens = [];
  // Generate suffixes
  for (let i = 0; i <= term.length - minLength; i++) {
    tokens.push(term.slice(i));
  }
  // Generate prefixes
  for (let i = minLength; i <= term.length; i++) {
    tokens.push(term.slice(0, i));
  }
  return tokens;
}
