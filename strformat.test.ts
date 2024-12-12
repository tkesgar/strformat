import { describe, it, expect } from "bun:test"
import { strformat } from "./strformat"

describe('strformat', () => {
  it('should render value from context', () => {
    const input = '[filename].[ext]'
    const context = {
      filename: 'foo',
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('foo.txt')
  })

  it('should call function and use the returned value if value is function', () => {
    const input = '[filename].[ext]'
    const context = {
      filename: () => 'bar',
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('bar.txt')
  })

  it('should call function with 1 parameter', () => {
    const input = '[filename:123].[ext]'
    const context = {
      filename: (x: string) => `foo_${x}`,
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('foo_123.txt')
  })

  it('should call function with 3 parameters', () => {
    const input = '[filename:123,456,789].[ext]'
    const context = {
      filename: (...args: string[]) => `foo_${args.join('')}`,
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('foo_123456789.txt')
  })
})
