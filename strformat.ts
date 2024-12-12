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

      const value = fn(...fnArgs.split(','))

      if (typeof value === 'string') {
        return value
      }
      if (value?.toString) {
        return value.toString()
      }
      throw new Error(`Cannot use returned value from context function`)
    } else {
      let value = context[key]
      if (typeof value === 'function') {
        value = value()
      }

      if (typeof value === 'string') {
        return value
      }

      if (value?.toString) {
        return value.toString()
      }

      throw new Error(`Cannot use value from context`)
    }
  })

  return output
}
