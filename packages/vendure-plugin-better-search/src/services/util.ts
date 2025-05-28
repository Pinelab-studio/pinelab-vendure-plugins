/**
 * Returns all suffixes of a term of length at least minLength.
 *
 * This is used so that searching for "shop" also finds "webshop", because it ends with "shop".
 */
export const suffixes = (term: string, minLength: number) => {
  if (term == null) return;
  const tokens = [];
  for (let i = 0; i <= term.length - minLength; i++) {
    tokens.push(term.slice(i));
  }
  return tokens;
};
