// Coerce value as string, returns undefined if we can't use the value
function coerceValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (value?.toString) {
    return value.toString()
  }
}

function traverseKeys(keys: string[], obj: any): unknown {
  if (keys.length === 0) {
    return undefined
  }

  if (keys.length === 1) {
    return obj?.[keys[0]] ?? undefined
  }

  return traverseKeys(keys.slice(1), obj?.[keys[0]] ?? undefined)
}

function traversePath(path: string, obj: any): unknown {
  if (path.startsWith('.')) {
    return traverseKeys(path.slice(1).split('.'), obj)
  }

  return traverseKeys(path.split('.'), obj)
}

function evalValueFromContext(key: string, context: Record<string, unknown>) {
  const matchKeyPattern = /^(.*?):(.*)$/.exec(key)
  if (matchKeyPattern) {
    const [fnKey, fnArgs] = matchKeyPattern.slice(1)

    const fn = traversePath(fnKey, context)
    if (typeof fn !== 'function') {
      throw new Error(`${fnKey} is not a function`)
    }

    const value = coerceValue(fn(...fnArgs.split(',').map(v => v.startsWith('@') ? evalValueFromContext(v.slice(1), context) : v)))
    if (typeof value === 'undefined') {
      throw new Error(`Cannot use returned value from context function`)
    } else {
      return value
    }
  } else {
    let ctxValue = traversePath(key, context)
    if (typeof ctxValue === 'function') {
      ctxValue = ctxValue()
    }

    return coerceValue(ctxValue)
  }
}

export function strformat(input: string, context: Record<string, unknown>): string {
  let output = input

  output = input.replaceAll(/\[.*?\]/g, (pattern) => {
    const key = pattern.slice(1, -1)

    if (!key.includes('|')) {
      const value = evalValueFromContext(key, context)
      if (typeof value === 'undefined') {
        throw new Error(`Cannot use value from context`)
      } else {
        return value
      }
    } else {
      const [firstKey, ...restKeys] = key.split('|')

      let currentValue: string | undefined = evalValueFromContext(firstKey, context)
      for (const key of restKeys) {
        const matchKeyPattern = /^(.*?):(.*)$/.exec(key)
        if (matchKeyPattern) {
          const [fnKey, fnArgs] = matchKeyPattern.slice(1)

          if (fnKey === '') {
            currentValue = fnArgs.startsWith('@') ? evalValueFromContext(fnArgs.slice(1), context) : fnArgs
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

          currentValue = coerceValue(fn(currentValue, ...fnArgs.split(',')))
        } else {
          // Ignore key if current value is undefined (we will have special values later)
          if (typeof currentValue === 'undefined') {
            continue
          }

          const fn = context[key]
          if (typeof fn !== 'function') {
            throw new Error(`${key} is not a function`)
          }

          currentValue = coerceValue(fn(currentValue))
        }
      }

      if (typeof currentValue === 'undefined') {
        throw new Error('Pipe sequence evaluates to undefined')
      }

      return currentValue
    }
  })

  return output
}
