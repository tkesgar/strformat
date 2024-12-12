// Coerce value as string, returns undefined if we can't use the value
function coerceValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (value?.toString) {
    return value.toString()
  }
}

export function strformat(input: string, context: Record<string, unknown>): string {
  let output = input

  output = input.replaceAll(/\[.*?\]/g, (pattern) => {
    const key = pattern.slice(1, -1)

    const matchKeyPattern = /^(.*?):(.*)$/.exec(key)
    if (matchKeyPattern) {
      const [fnKey, fnArgs] = matchKeyPattern.slice(1)

      const fn = context[fnKey]
      if (typeof fn !== 'function') {
        throw new Error(`${fnKey} is not a function`)
      }

      const value = coerceValue(fn(...fnArgs.split(',')))
      if (typeof value === 'undefined') {
        throw new Error(`Cannot use returned value from context function`)
      } else {
        return value
      }
    } else {
      let ctxValue = context[key]
      if (typeof ctxValue === 'function') {
        ctxValue = ctxValue()
      }

      const value = coerceValue(ctxValue)
      if (typeof value === 'undefined') {
        throw new Error(`Cannot use value from context`)
      } else {
        return value
      }
    }
  })

  return output
}
