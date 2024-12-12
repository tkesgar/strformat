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

  it('should pipe the value to transform function', () => {
    const input = '[filename|upper].[ext]'
    const context = {
      filename: 'foo',
      ext: 'txt',
      upper: (str: string) => str.toUpperCase()
    }

    expect(strformat(input, context)).toBe('FOO.txt')
  })

  it('should pass arguments to transform function', () => {
    const input = '[filename|slice:1,4].[ext]'
    const context = {
      filename: 'foobar',
      ext: 'txt',
      slice: (str: string, a: string, b: string) => str.slice(Number(a), Number(b))
    }

    expect(strformat(input, context)).toBe('oob.txt')
  })

  it('should pass multiple pipes', () => {
    const input = '[filename|slice:1,4|upper].[ext]'
    const context = {
      filename: 'foobar',
      ext: 'txt',
      slice: (str: string, a: string, b: string) => str.slice(Number(a), Number(b)),
      upper: (str: string) => str.toUpperCase()
    }

    expect(strformat(input, context)).toBe('OOB.txt')
  })

  it('can provide default value', () => {
    const input = '[filename|:default].[ext]'
    const context = {
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('default.txt')
  })

  it('default value walks through the pipe', () => {
    const input = '[filename|:default|upper].[ext]'
    const context = {
      ext: 'txt',
      upper: (str: string) => str.toUpperCase()
    }

    expect(strformat(input, context)).toBe('DEFAULT.txt')
  })

  it('can use path in value', () => {
    const input = '[file.name].[ext]'
    const context = {
      file: {
        name: 'foo'
      },
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('foo.txt')
  })

  it('can use array index in value', () => {
    const input = '[files.1.name].[ext]'
    const context = {
      files: [
        { name: 'foo' },
        { name: 'bar' },
      ],
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('bar.txt')
  })

  it('can traverse deep and return default value', () => {
    const input = '[files.1.type|:default].[ext]'
    const context = {
      files: [
        { name: 'foo' },
        { name: 'bar' },
      ],
      ext: 'txt'
    }

    expect(strformat(input, context)).toBe('default.txt')
  })

  it('can refer to context in parameters', () => {
    const input = '[hash:@config.length].[ext]'
    const context = {
      hash: (length: string) => 'b4f234798dbd8435c44412ff121c9726'.slice(0, Number(length)),
      ext: 'txt',
      config: {
        length: 8
      }
    }

    expect(strformat(input, context)).toBe('b4f23479.txt')
  })

  it('can refer to context in default value', () => {
    const input = '[hash:@config.length|:@config.default].[ext]'
    const context = {
      hash: (length: string) => 'b4f234798dbd8435c44412ff121c9726'.slice(0, Number(length)),
      ext: 'txt',
      config: {
        default: 'default',
        length: 8
      }
    }

    expect(strformat(input, context)).toBe('default.txt')
  })
})
