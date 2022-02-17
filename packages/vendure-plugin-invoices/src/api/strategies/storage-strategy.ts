export interface StorageStrategy {
  /**
   * Store the given file where you want and return a reference
   * that can later be used to retrieve the same invoice
   */
  save(filePath: string): Promise<string>;

  /**
   * Returns a downloadlink where an unauthenticated user can download the Invoice file.
   */
  getPublicUrl(reference: string): Promise<string>;
}

/**
 * Default storage strategy just leaves the file in /tmp/
 * Use this strategy just for testing
 */
export class DefaultStorageStrategy implements StorageStrategy {
  async save(filePath: string) {
    return filePath;
  }

  async getPublicUrl(reference: string) {
    return reference;
  }
}
