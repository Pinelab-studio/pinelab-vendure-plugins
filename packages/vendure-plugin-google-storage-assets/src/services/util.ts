/**
 * Removes the extension from a filename if it has one
 */
export function removeExtension(filename?: string): string {
  if (!filename) {
    return '';
  }
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
}
