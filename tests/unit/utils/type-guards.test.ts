import { describe, it, expect } from 'vitest';
import {
  isString,
  isNumber,
  isObject,
  isArray,
  getStringProperty,
  getNumberProperty,
  getObjectProperty,
  getArrayProperty,
  extractStrings,
  assertDefined,
  isError,
  toError,
  getErrorProperties,
} from '../../../src/utils/type-guards.js';

describe('Type Guards', () => {
  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString('123')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString(true)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber(Infinity)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber({})).toBe(false);
      expect(isNumber([])).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
      expect(isObject(new Object())).toBe(true);
    });

    it('should return false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(new Array())).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray({})).toBe(false);
      expect(isArray('string')).toBe(false);
      expect(isArray(123)).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
    });
  });

  describe('getStringProperty', () => {
    const obj = {
      name: 'John',
      age: 30,
      active: true,
      data: { nested: 'value' },
    };

    it('should return string values', () => {
      expect(getStringProperty(obj, 'name')).toBe('John');
    });

    it('should return default for non-string values', () => {
      expect(getStringProperty(obj, 'age')).toBe('');
      expect(getStringProperty(obj, 'active')).toBe('');
      expect(getStringProperty(obj, 'data')).toBe('');
    });

    it('should return default for missing keys', () => {
      expect(getStringProperty(obj, 'missing')).toBe('');
    });

    it('should use custom default value', () => {
      expect(getStringProperty(obj, 'missing', 'default')).toBe('default');
      expect(getStringProperty(obj, 'age', 'N/A')).toBe('N/A');
    });
  });

  describe('getNumberProperty', () => {
    const obj = {
      age: 30,
      count: 0,
      name: 'John',
      active: true,
    };

    it('should return number values', () => {
      expect(getNumberProperty(obj, 'age')).toBe(30);
      expect(getNumberProperty(obj, 'count')).toBe(0);
    });

    it('should return default for non-number values', () => {
      expect(getNumberProperty(obj, 'name')).toBe(0);
      expect(getNumberProperty(obj, 'active')).toBe(0);
    });

    it('should return default for missing keys', () => {
      expect(getNumberProperty(obj, 'missing')).toBe(0);
    });

    it('should use custom default value', () => {
      expect(getNumberProperty(obj, 'missing', -1)).toBe(-1);
      expect(getNumberProperty(obj, 'name', 999)).toBe(999);
    });
  });

  describe('getObjectProperty', () => {
    const obj = {
      data: { nested: 'value' },
      name: 'John',
      items: [1, 2, 3],
    };

    it('should return object values', () => {
      const result = getObjectProperty(obj, 'data');
      expect(result).toEqual({ nested: 'value' });
    });

    it('should return undefined for non-object values', () => {
      expect(getObjectProperty(obj, 'name')).toBeUndefined();
      expect(getObjectProperty(obj, 'items')).toBeUndefined();
    });

    it('should return undefined for missing keys', () => {
      expect(getObjectProperty(obj, 'missing')).toBeUndefined();
    });
  });

  describe('getArrayProperty', () => {
    const obj = {
      items: [1, 2, 3],
      tags: ['a', 'b', 'c'],
      name: 'John',
      data: { nested: 'value' },
    };

    it('should return array values', () => {
      expect(getArrayProperty(obj, 'items')).toEqual([1, 2, 3]);
      expect(getArrayProperty(obj, 'tags')).toEqual(['a', 'b', 'c']);
    });

    it('should return undefined for non-array values', () => {
      expect(getArrayProperty(obj, 'name')).toBeUndefined();
      expect(getArrayProperty(obj, 'data')).toBeUndefined();
    });

    it('should return undefined for missing keys', () => {
      expect(getArrayProperty(obj, 'missing')).toBeUndefined();
    });
  });

  describe('extractStrings', () => {
    it('should extract only strings from mixed array', () => {
      const mixed = ['hello', 123, 'world', null, true, 'test', undefined, {}];
      expect(extractStrings(mixed)).toEqual(['hello', 'world', 'test']);
    });

    it('should return empty array for array with no strings', () => {
      expect(extractStrings([123, null, true, {}])).toEqual([]);
    });

    it('should return all strings when array contains only strings', () => {
      expect(extractStrings(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty array', () => {
      expect(extractStrings([])).toEqual([]);
    });
  });

  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined('value')).not.toThrow();
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
      expect(() => assertDefined('')).not.toThrow();
      expect(() => assertDefined({})).not.toThrow();
    });

    it('should throw for null', () => {
      expect(() => assertDefined(null)).toThrow('Value is null or undefined');
    });

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined)).toThrow('Value is null or undefined');
    });

    it('should use custom error message', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('isError', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('test'))).toBe(true);
      expect(isError(new RangeError('test'))).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isError('error')).toBe(false);
      expect(isError({ message: 'error' })).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError(123)).toBe(false);
    });
  });

  describe('toError', () => {
    it('should return Error instances as-is', () => {
      const error = new Error('test');
      expect(toError(error)).toBe(error);
    });

    it('should convert string to Error', () => {
      const error = toError('error message');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('error message');
    });

    it('should convert object with message to Error', () => {
      const error = toError({ message: 'error message', code: 500 });
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('error message');
      expect((error as any).code).toBe(500);
    });

    it('should handle unknown error types', () => {
      const error = toError(123);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Unknown error occurred');
    });

    it('should handle null and undefined', () => {
      expect(toError(null).message).toBe('Unknown error occurred');
      expect(toError(undefined).message).toBe('Unknown error occurred');
    });
  });

  describe('getErrorProperties', () => {
    it('should extract properties from Error', () => {
      const error = new Error('test error');
      const props = getErrorProperties(error);
      
      expect(props.message).toBe('test error');
      expect(props.name).toBe('Error');
      expect(props.stack).toBeDefined();
    });

    it('should extract custom properties from Error', () => {
      const error = new Error('test') as any;
      error.code = 'TEST_ERROR';
      error.details = { foo: 'bar' };
      
      const props = getErrorProperties(error);
      
      expect(props.message).toBe('test');
      expect(props.code).toBe('TEST_ERROR');
      expect(props.details).toEqual({ foo: 'bar' });
    });

    it('should handle non-Error values', () => {
      const props = getErrorProperties('string error');
      expect(props.message).toBe('string error');
    });

    it('should handle objects', () => {
      const props = getErrorProperties({ custom: 'error' });
      expect(props.message).toBe('[object Object]');
    });

    it('should handle null and undefined', () => {
      expect(getErrorProperties(null).message).toBe('null');
      expect(getErrorProperties(undefined).message).toBe('undefined');
    });
  });
});

