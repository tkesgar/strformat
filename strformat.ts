/**
 * Returns a preferred string representation of the given `value` if possible,
 * or `undefined` if the value does not have possible string representation.
 *
 * Because strformat may be used for generating file names, we tried to return
 * filename-safe string whenever possible, with some exceptions. See the tests
 * for more details on specific cases.
 *
 * @param value
 * @returns
 */
export function coerceToString(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':
      return value
    case 'function':
    case 'undefined':
      return undefined
    case 'symbol':
      return value.description
    default:
      if (value instanceof Date) {
        return Math.floor(value.getTime() / 1000).toString();
      }

      return value?.toString()
  }
}

export function traverseKeys(keys: string[], obj: any): unknown {
  if (keys.length === 0) {
    return undefined
  }

  if (keys.length === 1) {
    return obj?.[keys[0]] ?? undefined
  }

  return traverseKeys(keys.slice(1), obj?.[keys[0]] ?? undefined)
}

export type StrformatFn = (input: string, context: Record<string, unknown>) => string

interface CreateStrformatOpts {
  stringify?: (value: unknown, key: string) => string | undefined
  delimiters?: {
    start?: string
    end?: string
    call?: string
    params?: string
    ctx?: string
    path?: string
    pipe?: string
  }
}

export function createStrformat(opts: CreateStrformatOpts = {}): StrformatFn {
  const {
    stringify = coerceToString,
  } = opts

  const DELIM_START = opts.delimiters?.start ?? '['
  const DELIM_END = opts.delimiters?.end ?? ']'
  const DELIM_CALL = opts.delimiters?.call ?? ':'
  const DELIM_PARAMS = opts.delimiters?.params ?? ','
  const DELIM_CTX = opts.delimiters?.ctx ?? '@'
  const DELIM_PATH = opts.delimiters?.path ?? '.'
  const DELIM_PIPE = opts.delimiters?.pipe ?? '|'

  const RE_KEY_PATTERN = new RegExp(`^(.*?)\\${DELIM_CALL}(.*)$`)

  function evalValueFromContext(key: string, context: Record<string, unknown>) {
    const matchKeyPattern = RE_KEY_PATTERN.exec(key)
    if (matchKeyPattern) {
      const [fnKey, fnArgs] = matchKeyPattern.slice(1)

      const fn = traverseKeys(fnKey.split(DELIM_PATH), context)
      if (typeof fn !== 'function') {
        throw new Error(`${fnKey} is not a function`)
      }

      const fnResult = fn(...fnArgs.split(DELIM_PARAMS).map(v => v.startsWith(DELIM_CTX) ? evalValueFromContext(v.slice(1), context) : v))
      const value = stringify(fnResult, fnKey)
      if (typeof value === 'undefined') {
        throw new Error(`Cannot use returned value from context function`)
      } else {
        return value
      }
    } else {
      let ctxValue = traverseKeys(key.split(DELIM_PATH), context)
      if (typeof ctxValue === 'function') {
        ctxValue = ctxValue()
      }

      return stringify(ctxValue, key)
    }
  }

  return (input: string, context: Record<string, unknown>): string => {
    const regexInput = new RegExp(`\\${DELIM_START}.*?\\${DELIM_END}`, 'g')
    return input.replaceAll(regexInput, (pattern) => {
      const key = pattern.slice(1, -1)

      if (!key.includes(DELIM_PIPE)) {
        const value = evalValueFromContext(key, context)
        if (typeof value === 'undefined') {
          throw new Error(`Cannot use value from context`)
        } else {
          return value
        }
      } else {
        const [firstKey, ...restKeys] = key.split(DELIM_PIPE)

        let currentValue: string | undefined = evalValueFromContext(firstKey, context)
        for (const key of restKeys) {
          const matchKeyPattern = RE_KEY_PATTERN.exec(key)
          if (matchKeyPattern) {
            const [fnKey, fnArgs] = matchKeyPattern.slice(1)

            if (fnKey === '') {
              currentValue = fnArgs.startsWith(DELIM_CTX) ? evalValueFromContext(fnArgs.slice(1), context) : fnArgs
              continue
            }

            // Ignore key if current value is undefined (we will have special values later)
            if (typeof currentValue === 'undefined') {
              continue
            }

            const fn = context[fnKey]
            if (typeof fn !== 'function') {
              throw new Error(`${fnKey} is not a function`)
            }

            const fnResult = fn(currentValue, ...fnArgs.split(DELIM_PARAMS))
            currentValue = stringify(fnResult, fnKey)
          } else {
            // Ignore key if current value is undefined (we will have special values later)
            if (typeof currentValue === 'undefined') {
              continue
            }

            const fn = context[key]
            if (typeof fn !== 'function') {
              throw new Error(`${key} is not a function`)
            }

            currentValue = stringify(fn(currentValue), key)
          }
        }

        if (typeof currentValue === 'undefined') {
          throw new Error('Pipe sequence evaluates to undefined')
        }

        return currentValue
      }
    })
  }
}
