/**
 * Returns a preferred string representation of the given `value` if possible,
 * or `undefined` if the value does not have possible string representation.
 *
 * Because strformat may be used for generating file names, we tried to return
 * filename-safe string whenever possible, with some exceptions. See the tests
 * for more details on specific cases.
 */
export function coerceToString(value: unknown): string | undefined {
  switch (typeof value) {
    case "string":
      return value;
    case "function":
    case "undefined":
      return undefined;
    case "symbol":
      return value.description;
    default:
      if (value instanceof Date) {
        return Math.floor(value.getTime() / 1000).toString();
      }

      return value?.toString();
  }
}

/**
 * Traverse through an object using an array of keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function traverseKeys(keys: string[], obj: any): unknown {
  if (keys.length === 0) {
    return undefined;
  }

  if (keys.length === 1) {
    return obj?.[keys[0]] ?? undefined;
  }

  return traverseKeys(keys.slice(1), obj?.[keys[0]] ?? undefined);
}

type StrformatContext = Record<string, unknown>;

export type Strformat = (input: string, context: StrformatContext) => string;

interface CreateStrformatOpts {
  stringify?: (value: unknown, key: string) => string | undefined;
  delimiters?: {
    start?: string;
    end?: string;
    call?: string;
    params?: string;
    ctx?: string;
    path?: string;
    pipe?: string;
  };
}

export const ERROR_CONTEXT_NOT_FOUND = 101;

export const ERROR_CONTEXT_NOT_FUNCTION = 102;

export const ERROR_PIPE_UNDEFINED = 103;

export const ERROR_CONTEXT_FUNCTION_ERROR = 104;

export type StrformatErrorCode =
  | typeof ERROR_CONTEXT_NOT_FOUND
  | typeof ERROR_CONTEXT_NOT_FUNCTION
  | typeof ERROR_PIPE_UNDEFINED
  | typeof ERROR_CONTEXT_FUNCTION_ERROR;

export class StrformatError extends Error {
  readonly code: StrformatErrorCode;
  readonly pattern: string;

  constructor(
    message: string,
    code: StrformatErrorCode,
    pattern: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.code = code;
    this.pattern = pattern;
  }
}

export function createStrformat(opts: CreateStrformatOpts = {}): Strformat {
  const { stringify = coerceToString } = opts;

  const DELIM_START = opts.delimiters?.start ?? "[";
  const DELIM_END = opts.delimiters?.end ?? "]";
  const DELIM_CALL = opts.delimiters?.call ?? ":";
  const DELIM_PARAMS = opts.delimiters?.params ?? ",";
  const DELIM_CTX = opts.delimiters?.ctx ?? "@";
  const DELIM_PATH = opts.delimiters?.path ?? ".";
  const DELIM_PIPE = opts.delimiters?.pipe ?? "|";

  const RE_KEY_PATTERN = new RegExp(`^(.*?)\\${DELIM_CALL}(.*)$`);

  function resolveContextReference(
    value: string,
    context: StrformatContext,
    originalPattern: string,
  ) {
    if (value.startsWith(DELIM_CTX)) {
      const key = value.slice(1);
      return getValueFromContext(key, context, originalPattern);
    }

    return value;
  }

  function getValueFromContext(
    key: string,
    context: StrformatContext,
    originalPattern: string,
  ) {
    // Check if the key contains call delimiter, e.g. `foo:a,b,c`.
    // If it contains call delimiter, we need to call the function; otherwise,
    // we can directly check the value in context.
    const matchKeyPattern = RE_KEY_PATTERN.exec(key);
    if (matchKeyPattern) {
      // fnKey = foo
      // fnArgs = a,b,c
      const [fnKey, fnArgs] = matchKeyPattern.slice(1);

      // Get the context value. We expect the value to be a function.
      const fn = traverseKeys(fnKey.split(DELIM_PATH), context);
      if (typeof fn !== "function") {
        throw new StrformatError(
          `Context value '${fnKey}' is not a function`,
          ERROR_CONTEXT_NOT_FUNCTION,
          originalPattern,
        );
      }

      // Function params may have reference to context, so we need to get the value.
      const fnParsedArgs = fnArgs
        .split(DELIM_PARAMS)
        .map((arg) => resolveContextReference(arg, context, originalPattern));

      try {
        const fnResult: unknown = fn(...fnParsedArgs);
        return stringify(fnResult, fnKey);
      } catch (error) {
        throw new StrformatError(
          `Error on context function value '${fnKey}'`,
          ERROR_CONTEXT_FUNCTION_ERROR,
          originalPattern,
          error,
        );
      }
    } else {
      // Get the context value. If the value is a function, call it without
      // parameters.
      let ctxValue = traverseKeys(key.split(DELIM_PATH), context);
      if (typeof ctxValue === "function") {
        try {
          ctxValue = ctxValue();
        } catch (error) {
          throw new StrformatError(
            `Error on context function value '${key}'`,
            ERROR_CONTEXT_FUNCTION_ERROR,
            originalPattern,
            error,
          );
        }
      }

      return stringify(ctxValue, key);
    }
  }

  return (input: string, context: StrformatContext): string => {
    // Find all [foo] and [bar] substrings.
    // TODO Look for async alternatives that we can use.
    const regexInput = new RegExp(`\\${DELIM_START}.*?\\${DELIM_END}`, "g");
    return input.replaceAll(regexInput, (pattern) => {
      // pattern: [foo]
      // key: foo
      const key = pattern.slice(1, -1);

      // If the key does not have |, simply get the value.
      // Otherwise we need to evaluate each pipe segments one by one.
      if (!key.includes(DELIM_PIPE)) {
        const value = getValueFromContext(key, context, pattern);
        if (typeof value === "undefined") {
          throw new StrformatError(
            `Context does not contain '${key}'`,
            ERROR_CONTEXT_NOT_FOUND,
            pattern,
          );
        } else {
          return value;
        }
      }

      // Use the first key to get the initial value for the pipe sequence.
      // Note that here we allow the initial value to be undefined to implement
      // default value mechanism ([|:default]).
      const [firstKey, ...restKeys] = key.split(DELIM_PIPE);
      let currentValue: string | undefined = getValueFromContext(
        firstKey,
        context,
        pattern,
      );

      // Loop through each remaining pipe segments and call the function from
      // context to currentValue.
      //
      // Note that this is similar with getValueFromContext, except we want the
      // context value to be function (so we can call it using currentValue).
      for (const key of restKeys) {
        // Check if the key contains call delimiter, e.g. `foo:a,b,c`.
        // If it contains call delimiter, there will be additional parameters to
        // the function call.
        const matchKeyPattern = RE_KEY_PATTERN.exec(key);
        if (matchKeyPattern) {
          const [fnKey, fnArgs] = matchKeyPattern.slice(1);

          // If fnKey is empty string (|:default|), we use the function argument
          // to replace the value, but only if currentValue is undefined.
          if (fnKey === "") {
            currentValue ??= resolveContextReference(fnArgs, context, pattern);
            continue;
          }

          // Fall through to the next pipe if currentValue is undefined
          // (we cannot call the function on anything).
          if (typeof currentValue === "undefined") {
            continue;
          }

          // Get the context value. We expect the value to be a function.
          const fn = context[fnKey];
          if (typeof fn !== "function") {
            throw new StrformatError(
              `Context value '${fnKey}' is not a function`,
              ERROR_CONTEXT_NOT_FUNCTION,
              pattern,
            );
          }

          // Function params may have reference to context, so we need to get the value.
          const fnParsedArgs = fnArgs
            .split(DELIM_PARAMS)
            .map((arg) => resolveContextReference(arg, context, pattern));

          let fnResult;
          try {
            fnResult = fn(currentValue, ...fnParsedArgs);
          } catch (error) {
            throw new StrformatError(
              `Error on context function '${fnKey}'`,
              ERROR_CONTEXT_FUNCTION_ERROR,
              pattern,
              error,
            );
          }

          currentValue = stringify(fnResult, fnKey);
        } else {
          // Fall through to the next pipe if currentValue is undefined
          // (we cannot call the function on anything).
          if (typeof currentValue === "undefined") {
            continue;
          }

          // Get the context value. We expect the value to be a function.
          const fn = context[key];
          if (typeof fn !== "function") {
            throw new StrformatError(
              `Context value '${key}' is not a function`,
              ERROR_CONTEXT_NOT_FUNCTION,
              pattern,
            );
          }

          let fnResult;
          try {
            fnResult = fn(currentValue);
          } catch (error) {
            throw new StrformatError(
              `Error on context function '${key}'`,
              ERROR_CONTEXT_FUNCTION_ERROR,
              pattern,
              error,
            );
          }
          currentValue = stringify(fnResult, key);
        }
      }

      // We cannot use undefined as value.
      if (typeof currentValue === "undefined") {
        throw new StrformatError(
          `Pipe sequence evaluates to undefined`,
          ERROR_PIPE_UNDEFINED,
          pattern,
        );
      }

      return currentValue;
    });
  };
}
