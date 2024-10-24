/**
 * This helper keeps polling a condition function until it returns a value or times out.
 * Use this instead of arbitrary `await new Promise()` calls.
 *
 * @example
 * // This invoice will be defined, or an error is thrown after timeout
 * const invoice = await waitFor(() => getInvoice(order.id));
 */
export async function waitFor<T>(
  conditionFn: () => Promise<T | undefined> | T | undefined,
  interval = 100,
  timeout = 10000
) {
  const startTime = Date.now();
  let result: T | undefined;
  let elapsedTime = 0;
  while (elapsedTime < timeout) {
    result = await conditionFn();
    if (result) {
      return result;
    }
    elapsedTime = Date.now() - startTime;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`'waitFor()' Failed to resolve a value after ${timeout}ms`);
}
