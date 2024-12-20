import { describe, it, expect, mock } from "bun:test";
import {
  coerceToString,
  ERROR_CONTEXT_FUNCTION_ERROR,
  traverseKeys,
} from "./strformat";
import {
  createStrformat,
  StrformatError,
  strformat,
  strformatfs,
  ERROR_CONTEXT_NOT_FUNCTION,
  ERROR_CONTEXT_NOT_FOUND,
  ERROR_PIPE_UNDEFINED,
} from ".";

describe("coerceToString", () => {
  describe("string values", () => {
    it.each([
      ["", ""],
      [0, "0"],
      [123, "123"],
      [true, "true"],
      [false, "false"],
      ["hallo", "hallo"],
      [1234567890123456789n, "1234567890123456789"],
      // Symbol may have string representation in `s.description`. Otherwise,
      // `s.description` is undefined. The string representation might not be
      // filename-safe, but we will leave it to the user.
      [Symbol("wah"), "wah"],
      // Convert date to UNIX timestamp (in seconds) instead of miliseconds.
      [new Date(123456789000), "123456789"],
      // Convert specific date correctly
      [new Date("2024-12-20T08:09:10.123Z"), "1734682150"],
      [{}, "[object Object]"],
      [NaN, "NaN"],
      [Infinity, "Infinity"],
    ])("should coerce `%p` to %s", (value, stringValue) => {
      expect(coerceToString(value)).toBe(stringValue);
    });

    it.each([
      [
        {
          foo: "bar",
          toString(): string {
            return "-baz-";
          },
        },
        "-baz-",
      ],
      [Math, "[object Math]"],
    ])("should coerce %o to %s", (value, stringValue) => {
      expect(coerceToString(value)).toBe(stringValue);
    });
  });

  describe("undefined values", () => {
    it.each([[() => 123], [Symbol()], [null], [undefined]])(
      "should coerce `%j` to undefined",
      (value) => {
        expect(coerceToString(value)).toBeUndefined();
      },
    );
  });
});

describe("traverseKeys", () => {
  const obj = {
    foo: "bar",
    baz: {
      uwu: 123,
    },
    arr: [
      {
        name: "valueA",
        value: 100,
      },
      {
        name: "valueB",
        value: 200,
      },
      {
        name: "valueC",
        value: 300,
      },
    ],
  };

  it.each([
    ["foo", "bar"],
    ["baz", { uwu: 123 }],
    ["baz.uwu", 123],
    ["arr.0", { name: "valueA", value: 100 }],
    ["arr.1.name", "valueB"],
    ["arr.2.value", 300],
  ])("should return `%s` from the object given the path", (path, value) => {
    expect(traverseKeys(path.split("."), obj)).toEqual(value);
  });

  it.each([["bass"], ["a.b.c.d.e"], ["1.2.3.4.5"], ["."], [""]])(
    "should return undefined for non-existing path %s",
    (path) => {
      expect(traverseKeys(path.split("."), obj)).toBeUndefined();
    },
  );

  it("should return undefined if the object is undefined", () => {
    expect(traverseKeys("foo.bar.baz".split("."), undefined)).toBeUndefined();
  });
});

describe("strformat", () => {
  it("should render value from context", () => {
    const input = "[filename].[ext]";
    const context = {
      filename: "foo",
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("foo.txt");
  });

  it("should call function and use the returned value if value is function", () => {
    const input = "[filename].[ext]";
    const context = {
      filename: () => "bar",
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("bar.txt");
  });

  it("should call function with 1 parameter", () => {
    const input = "[filename:123].[ext]";
    const context = {
      filename: (x: string) => `foo_${x}`,
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("foo_123.txt");
  });

  it("should call function with 3 parameters", () => {
    const input = "[filename:123,456,789].[ext]";
    const context = {
      filename: (...args: string[]) => `foo_${args.join("")}`,
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("foo_123456789.txt");
  });

  it("should pipe the value to transform function", () => {
    const input = "[filename|upper].[ext]";
    const context = {
      filename: "foo",
      ext: "txt",
      upper: (str: string) => str.toUpperCase(),
    };

    expect(strformat(input, context)).toBe("FOO.txt");
  });

  it("should pass arguments to transform function", () => {
    const input = "[filename|slice:1,4].[ext]";
    const context = {
      filename: "foobar",
      ext: "txt",
      slice: (str: string, a: string, b: string) =>
        str.slice(Number(a), Number(b)),
    };

    expect(strformat(input, context)).toBe("oob.txt");
  });

  it("should pass multiple pipes", () => {
    const input = "[filename|slice:1,4|upper].[ext]";
    const context = {
      filename: "foobar",
      ext: "txt",
      slice: (str: string, a: string, b: string) =>
        str.slice(Number(a), Number(b)),
      upper: (str: string) => str.toUpperCase(),
    };

    expect(strformat(input, context)).toBe("OOB.txt");
  });

  it("can provide default value", () => {
    const input = "[filename|:default].[ext]";
    const context = {
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("default.txt");

    expect(strformat(input, { ...context, filename: "foo" })).toBe("foo.txt");
  });

  it("default value walks through the pipe", () => {
    const input = "[filename|:default|upper].[ext]";
    const context = {
      ext: "txt",
      upper: (str: string) => str.toUpperCase(),
    };

    expect(strformat(input, context)).toBe("DEFAULT.txt");
  });

  it("can use path in value", () => {
    const input = "[file.name].[ext]";
    const context = {
      file: {
        name: "foo",
      },
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("foo.txt");
  });

  it("can use array index in value", () => {
    const input = "[files.1.name].[ext]";
    const context = {
      files: [{ name: "foo" }, { name: "bar" }],
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("bar.txt");
  });

  it("can traverse deep and return default value", () => {
    const input = "[files.1.type|:default].[ext]";
    const context = {
      files: [{ name: "foo" }, { name: "bar" }],
      ext: "txt",
    };

    expect(strformat(input, context)).toBe("default.txt");
  });

  it("can refer to context in parameters", () => {
    const input = "[hash:@config.length].[ext]";
    const context = {
      hash: (length: string) =>
        "b4f234798dbd8435c44412ff121c9726".slice(0, Number(length)),
      ext: "txt",
      config: {
        length: 8,
      },
    };

    expect(strformat(input, context)).toBe("b4f23479.txt");
  });

  it("can refer to context in default value", () => {
    const input = "[hash|:@config.default|slice:0,3].[ext]";
    const context = {
      ext: "txt",
      config: {
        default: "default",
        length: 8,
      },
      slice: (str: string, a: string, b: string) =>
        str.slice(Number(a), Number(b)),
    };

    expect(strformat(input, context)).toBe("def.txt");
  });
});

describe("strformatfs", () => {
  it("should use filesystem-safe delimiters", () => {
    const input = "[hash#!@config.default#slice!0,3].[ext]";
    const context = {
      ext: "txt",
      config: {
        default: "default",
        length: 8,
      },
      slice: (str: string, a: string, b: string) =>
        str.slice(Number(a), Number(b)),
    };

    expect(strformatfs(input, context)).toBe("def.txt");
  });
});

describe("createStrformat", () => {
  it("can customize strformat delimiters", () => {
    const strformat = createStrformat({
      delimiters: {
        start: "<",
        end: ">",
        call: "?",
        params: ";",
        ctx: "$",
        path: "/",
        pipe: "#",
      },
    });

    const input = "<hash#?$config/default#slice?0;3>.<ext>";
    const context = {
      ext: "txt",
      config: {
        default: "default",
        length: 8,
      },
      slice: (str: string, a: string, b: string) =>
        str.slice(Number(a), Number(b)),
    };

    expect(strformat(input, context)).toBe("def.txt");
  });

  it("can customize strformat serializer", () => {
    const strformat = createStrformat({
      stringify(value) {
        const str = JSON.stringify(value);
        return str.startsWith('"') ? str.slice(1, -1) : str;
      },
    });

    const input = "[name]@[date]";
    const context = {
      name: "foo",
      date: new Date(123456789000),
    };

    expect(strformat(input, context)).toBe("foo@1973-11-29T21:33:09.000Z");
  });

  it("serializer should receive value and key", () => {
    const stringify = mock(coerceToString);
    const strformat = createStrformat({ stringify });

    const input = "[hash|:@config.default|slice:0,3].[ext]";
    const context = {
      ext: "txt",
      config: {
        default: "default",
        length: 8,
      },
      slice: (str: string, a: string, b: string) =>
        str.slice(Number(a), Number(b)),
    };

    expect(strformat(input, context)).toBe("def.txt");
    expect(stringify).toBeCalledWith(undefined, "hash");
    expect(stringify).toBeCalledWith("default", "config.default");
    expect(stringify).toBeCalledWith("def", "slice");
    expect(stringify).toBeCalledWith("txt", "ext");
  });
});

describe("errors", () => {
  it("should throw error not a function", () => {
    const context = {
      foo: "bar",
    };
    const input = "[foo:123].txt";

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Context value 'foo' is not a function`);
        expect(error.code).toBe(ERROR_CONTEXT_NOT_FUNCTION);
        expect(error.pattern).toBe("[foo:123]");
      }
    }

    expect.assertions(3);
  });

  it("should throw error value does not exists", () => {
    const context = {};
    const input = "[foo].txt";

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Context does not contain 'foo'`);
        expect(error.code).toBe(ERROR_CONTEXT_NOT_FOUND);
        expect(error.pattern).toBe("[foo]");
      }
    }

    expect.assertions(3);
  });

  it("should throw error not a function (inside pipe, with parameter)", () => {
    const context = {
      foo: "bar",
      baz: 123,
    };
    const input = "[foo|baz:123].txt";

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Context value 'baz' is not a function`);
        expect(error.code).toBe(ERROR_CONTEXT_NOT_FUNCTION);
        expect(error.pattern).toBe("[foo|baz:123]");
      }
    }

    expect.assertions(3);
  });

  it("should throw error not a function (inside pipe, without parameter)", () => {
    const context = {
      foo: "bar",
      baz: 123,
    };
    const input = "[foo|baz].txt";

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Context value 'baz' is not a function`);
        expect(error.code).toBe(ERROR_CONTEXT_NOT_FUNCTION);
        expect(error.pattern).toBe("[foo|baz]");
      }
    }

    expect.assertions(3);
  });

  it("should throw error not a function (pipe undefined)", () => {
    const context = {
      foo: "bar",
      baz: () => undefined,
    };
    const input = "[foo|baz].txt";

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Pipe sequence evaluates to undefined`);
        expect(error.code).toBe(ERROR_PIPE_UNDEFINED);
        expect(error.pattern).toBe("[foo|baz]");
      }
    }

    expect.assertions(3);
  });

  it("should throw strformat error if the context function throws error (function call)", () => {
    const input = "[foo].[ext]";
    const context = {
      foo: () => {
        throw new Error("Oh noes!");
      },
      ext: "txt",
    };

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Error on context function value 'foo'`);
        expect(error.code).toBe(ERROR_CONTEXT_FUNCTION_ERROR);
        expect(error.pattern).toBe("[foo]");
        expect(error.cause).toBeInstanceOf(Error);
      }
    }

    expect.assertions(4);
  });

  it("should throw strformat error if the context function throws error (function call + args)", () => {
    const input = "[foo:123].[ext]";
    const context = {
      foo: () => {
        throw new Error("Oh noes!");
      },
      ext: "txt",
    };

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Error on context function value 'foo'`);
        expect(error.code).toBe(ERROR_CONTEXT_FUNCTION_ERROR);
        expect(error.pattern).toBe("[foo:123]");
        expect(error.cause).toBeInstanceOf(Error);
      }
    }

    expect.assertions(4);
  });

  it("should throw strformat error if the context function throws error (pipe)", () => {
    const input = "[foo|bar].[ext]";
    const context = {
      foo: 123,
      bar: () => {
        throw new Error("Oh noes!");
      },
      ext: "txt",
    };

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Error on context function 'bar'`);
        expect(error.code).toBe(ERROR_CONTEXT_FUNCTION_ERROR);
        expect(error.pattern).toBe("[foo|bar]");
        expect(error.cause).toBeInstanceOf(Error);
      }
    }

    expect.assertions(4);
  });

  it("should throw strformat error if the context function throws error (pipe + args)", () => {
    const input = "[foo|bar:123].[ext]";
    const context = {
      foo: 123,
      bar: () => {
        throw new Error("Oh noes!");
      },
      ext: "txt",
    };

    try {
      strformat(input, context);
    } catch (error) {
      if (error instanceof StrformatError) {
        expect(error.message).toBe(`Error on context function 'bar'`);
        expect(error.code).toBe(ERROR_CONTEXT_FUNCTION_ERROR);
        expect(error.pattern).toBe("[foo|bar:123]");
        expect(error.cause).toBeInstanceOf(Error);
      }
    }

    expect.assertions(4);
  });
});

describe("edge cases", () => {
  it("should allow empty string for default value", () => {
    const input = "[foo|:].[ext]";
    const context = {
      ext: "txt",
    };

    expect(strformat(input, context)).toBe(".txt");
  });

  it("should throw error for []", () => {
    const input = "[].[ext]";
    const context = {
      ext: "txt",
    };

    expect(() => strformat(input, context)).toThrowError(
      `Context does not contain ''`,
    );
  });

  it("should throw error for [:]", () => {
    const input = "[:].[ext]";
    const context = {
      ext: "txt",
    };

    expect(() => strformat(input, context)).toThrowError(
      `Context value '' is not a function`,
    );
  });

  it("should throw error for [@]", () => {
    const input = "[@].[ext]";
    const context = {
      ext: "txt",
    };

    expect(() => strformat(input, context)).toThrowError(
      `Context does not contain '@'`,
    );
  });

  it("should not cause infinite loop", () => {
    function hash() {
      return "@hash";
    }

    const input = "[|:@hash]";
    const context = {
      hash,
    };

    expect(strformat(input, context)).toBe("@hash");
  });

  it("should not cause infinite loop", () => {
    const input = "[|:@self]";
    const context = {
      self: "@self",
    };

    expect(strformat(input, context)).toBe("@self");
  });
});
