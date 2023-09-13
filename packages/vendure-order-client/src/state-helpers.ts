import { MapStore } from "nanostores";
import { ErrorCode, ErrorResult } from "./graphql-generated-types";
import { State } from "./vendure-order-client";

/**
 * Set loading to true for given store
 */
export function setLoading<T>(store: MapStore<State<T>>): void {
    store.setKey('loading', true);
}

/**
 * Set error state and set loading to false for given store
 */
export function setError<T>(store: MapStore<State<T>>, e: any): void {
    store.setKey('loading', false);
    store.setKey('error', {
        errorCode: ErrorCode.UnknownError,
        message: e?.message,
    });
}

/**
 * Set loading to false, result as data if not ErrorResult, otherwise set as error
 */
export function setResult<T>(store: MapStore<State<T>>, result: any | ErrorResult): void {
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
