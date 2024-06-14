/**
 * Generates a random token string.
 */
export function generateToken(): string {
  const randomString = () => Math.random().toString(36).substr(3, 10);
  return `${randomString()}${randomString()}`;
}
