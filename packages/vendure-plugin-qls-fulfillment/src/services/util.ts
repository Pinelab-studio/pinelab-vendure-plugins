export interface EanUpdate {
  eansToAdd: string[];
  eansToRemove: string[];
}
/**
 * Get the EANs to add or remove
 */
export function getEansToUpdate({
  existingEans,
  desiredEans,
}: {
  existingEans?: (string | undefined | null)[];
  desiredEans?: (string | undefined | null)[];
}): EanUpdate | false {
  const normalizedExisting = normalizeEans(existingEans);
  const normalizedDesired = normalizeEans(desiredEans);
  // Find out what EANs to add
  const eansToAdd = normalizedDesired.filter(
    (ean) => !normalizedExisting.includes(ean)
  );
  // Find out what EANs to remove
  const eansToRemove = normalizedExisting.filter(
    (ean) => !normalizedDesired.includes(ean)
  );
  if (eansToAdd.length === 0 && eansToRemove.length === 0) {
    return false;
  }
  return {
    eansToAdd,
    eansToRemove,
  };
}

/**
 * Normalize the EANs by filtering out null, undefined and empty strings and sorting them
 */
export function normalizeEans(eans?: (string | undefined | null)[]): string[] {
  return (eans ?? [])
    .filter((ean): ean is string => !!ean && ean.trim().length > 0)
    .map((ean) => ean.trim())
    .sort();
}
