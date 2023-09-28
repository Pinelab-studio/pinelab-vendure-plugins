import { MapStore } from 'nanostores';
import { ErrorCode, ErrorResult } from './graphql-generated-types';

/**
 * Interface defining loading and error states per store
 */
export interface StateStore<T> {
  loading: boolean;
  error: ErrorResult | undefined;
  data: T;
}

/**
 * Set result as data if not ErrorResult, otherwise set as error in store
 */
export function setResult<T>(
  store: MapStore<StateStore<T>>,
  result: unknown | ErrorResult
): void {
  store.setKey('loading', false);
  if ((result as ErrorResult)?.errorCode) {
    const errorResult = result as ErrorResult;
    store.setKey('error', {
      errorCode: errorResult.errorCode,
      message: errorResult.message,
    });
  } else {
    store.setKey('data', result as T);
  }
}

/**
 * Handle loading and error state for given store:
 * - Sets loading to true
 * - Executes given function
 * - Sets loading to false
 * - Returns result of function
 *
 * If an error is caught, it's set as error in the store and thrown.
 * Loading state is always set back to false
 */
export function HandleLoadingState(storeName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value; // Save a reference to the original method
    descriptor.value = async function (this: any, ...args: any[]) {
      const store: MapStore<StateStore<any>> = this[storeName];
      store.setKey('loading', true);
      if (!store) {
        throw new Error(`Store ${storeName} not found`);
      }
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (e: any) {
        store.setKey('error', {
          errorCode: ErrorCode.UnknownError,
          message: e?.message,
        });
      } finally {
        store.setKey('loading', false);
      }
    };
  };
}
