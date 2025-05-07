import { AddressLookupInput } from '../generated/graphql';

export function validateDutchPostalCode(
  input: AddressLookupInput
): true | string {
  const postalCode = normalizePostalCode(input.postalCode);
  if (postalCode.length !== 6) {
    return 'Postal code must be 4 numbers and 2 letters';
  }
  const numbers = postalCode.substring(0, 4);
  const letters = postalCode.substring(4);
  if (!/^\d{4}$/.test(numbers)) {
    return 'Postal code must start with 4 numbers';
  }
  if (!/^[A-Z]{2}$/.test(letters)) {
    return 'Postal code must end with 2 letters';
  }
  if (!input.houseNumber) {
    return 'House number is required for lookup';
  }
  return true;
}

/**
 * Normalize the postal code to a 6-character string with no spaces and uppercase letters.
 * E.g. '1234 AB' -> '1234AB'
 */
export function normalizePostalCode(postalCode: string): string {
  return postalCode.replace(/\s/g, '').toUpperCase();
}
