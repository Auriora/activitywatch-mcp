/**
 * Type guard utilities for runtime type checking
 */

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Safely get a string property from an object
 */
export function getStringProperty(
  obj: Record<string, unknown>,
  key: string,
  defaultValue: string = ''
): string {
  const value = obj[key];
  return isString(value) ? value : defaultValue;
}

/**
 * Safely get a number property from an object
 */
export function getNumberProperty(
  obj: Record<string, unknown>,
  key: string,
  defaultValue: number = 0
): number {
  const value = obj[key];
  return isNumber(value) ? value : defaultValue;
}

/**
 * Safely get an object property
 */
export function getObjectProperty(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = obj[key];
  return isObject(value) ? value : undefined;
}

/**
 * Safely get an array property
 */
export function getArrayProperty<T = unknown>(
  obj: Record<string, unknown>,
  key: string
): T[] | undefined {
  const value = obj[key];
  return isArray(value) ? (value as T[]) : undefined;
}

/**
 * Extract string values from an array, filtering out non-strings
 */
export function extractStrings(arr: unknown[]): string[] {
  return arr.filter(isString);
}

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string = 'Value is null or undefined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Check if an error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely convert unknown error to Error object
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  
  if (isString(error)) {
    return new Error(error);
  }
  
  if (isObject(error) && 'message' in error && isString(error.message)) {
    const err = new Error(error.message);
    Object.assign(err, error);
    return err;
  }
  
  return new Error('Unknown error occurred');
}

/**
 * Get error properties safely for logging
 */
export function getErrorProperties(error: unknown): Record<string, unknown> {
  if (!isError(error)) {
    return { message: String(error) };
  }

  const props: Record<string, unknown> = {
    message: error.message,
    name: error.name,
  };

  if (error.stack) {
    props.stack = error.stack;
  }

  // Get any additional enumerable properties
  for (const key of Object.keys(error)) {
    if (!(key in props)) {
      props[key] = (error as unknown as Record<string, unknown>)[key];
    }
  }

  return props;
}

