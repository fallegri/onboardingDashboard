/**
 * @description Discriminated union type representing either a successful value or an error.
 * Implements the Result/Either pattern for type-safe error handling across all modules.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * @description Represents a successful result containing a value of type T.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * @description Represents a failed result containing an error of type E.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * @description Creates a successful Result wrapping the given value.
 * @param value - The success value to wrap
 * @returns A Result in the Ok state containing the value
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * @description Creates a failed Result wrapping the given error.
 * @param error - The error value to wrap
 * @returns A Result in the Err state containing the error
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * @description Transforms the value inside a successful Result using the provided function.
 * If the Result is an error, it is returned unchanged.
 * @param result - The Result to transform
 * @param fn - The mapping function to apply to the success value
 * @returns A new Result with the transformed value, or the original error
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * @description Chains a function that returns a Result onto a successful Result.
 * If the Result is an error, it is returned unchanged. Useful for composing
 * operations that may each fail independently.
 * @param result - The Result to chain from
 * @param fn - The function returning a new Result to apply to the success value
 * @returns The Result from applying fn, or the original error
 */
export function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * @description Type guard that checks if a Result is in the Ok state.
 * @param result - The Result to check
 * @returns True if the Result contains a success value
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * @description Type guard that checks if a Result is in the Err state.
 * @param result - The Result to check
 * @returns True if the Result contains an error
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * @description Extracts the value from a Result, throwing if it is an error.
 * Use only when you are certain the Result is Ok.
 * @param result - The Result to unwrap
 * @returns The success value
 * @throws Error if the Result is in the Err state
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error('Called unwrap on an Err result');
}

/**
 * @description Extracts the value from a Result, returning a default if it is an error.
 * @param result - The Result to unwrap
 * @param defaultValue - The value to return if the Result is Err
 * @returns The success value or the default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}
