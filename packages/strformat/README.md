# @tkesgar/strformat

> Simple and minimal templating engine

strformat is a minimal string templating engine, intended for short strings such
as file names. It is inspired by Webpack template strings, with additional
features such as pipes and default values.

Design goals:

- Easily readable syntax
- Avoid tokens commonly used in other templates/interpolations, e.g. Bash
  (`$foo`, `${foo}`, `$(foo)`), GitLab CI, GitHub (`${{foo}}`)
- Extensibility: allow applications to add their own context values
- Security: do not directly allow evaluating user input

```
Template: [pkg.name]-v[pkg.version]-[node.process.platform]-[node.os.arch][compiler|:|prepend:-].tar.gz
Output:   mypkg-v1.2.3-linux-x64.tar.gz
```

See [strformat-cli] for usage in CLI.

## Usage

Install from NPM:

```
npm install @tkesgar/strformat
bun add @tkesgar/strformat
```

Use in code:

```js
import { strformat } from "@tkesgar/strformat";

console.log(
  strformat("script.[hash].[ext]", {
    hash: "abcd1234",
    ext: "txt",
  }),
);
```

## Specification

Simple template:

```js
const context = {
  filename: "foo"
  ext: "txt"
}

strformat("[filename].[ext]", context)
// foo.txt
```

Context value can be a function:

```js
const context = {
  random: () => crypto.randomBytes(16).toString("hex"),
  ext: "txt",
};

strformat("[random].[ext]", context);
// 8c8ccdbfa2ebb57609eec9e82a9e6810.txt
```

Context value function can receive parameters:

```js
const context = {
  random(_len, _enc) {
    const len = Number(_len) || 16;
    const enc = ["hex", "base64", "base64url"].includes(_enc) ? _enc : "hex";

    return crypto.randomBytes(Number(len) || 16).toString(enc);
  },
  ext: "txt",
};

strformat("[random].[ext]", context);
// a9ca8061ed985c9f82ab635939b710b4.txt
strformat("[random:8].[ext]", context);
// 81b9d5eecaf5d918.txt
strformat("[random:8,base64url].[ext]", context);
// UKuDqfNinQY.txt
```

Use pipe (`|`) to pass value to next function, which will receive the previous
string value and any additional parameters:

```js
const context = {
  filename: "foobar",
  ext: "txt",
  upper: str => str.toUpperCase(),
  slice: (str: string, a: string, b: string) => str.slice(Number(a), Number(b)),
}

strformat("[filename|slice:1,4|upper].[ext]", context)
// OOB.txt
```

Pipe to empty function name returns the parameter string itself (`|:foo`) if the
previous value is `undefined`. This allows constructs such as default values
(`[unknown|:defaultvalue]`). The string can be piped to next functions as well:

```js
const context = {
  upper: (str) => str.toUpperCase(),
};

strformat(".env.[env|:development|upper]", context);
// .env.DEVELOPMENT

context.env = "production";
strformat(".env.[env|:development|upper]", context);
// .env.PRODUCTION
```

Use `.` to traverse through value in the context:

```js
const context = {
  pkg: {
    name: "mypkg",
    version: "1.2.3",
  },
  node: {
    os,
    process,
  },
  prepend: (str, prefix) => str && prefix + str,
};

strformat(
  "[pkg.name]-v[pkg.version]-[node.process.platform]-[node.os.arch][compiler|:|prepend:-].tar.gz",
  context,
);
// mypkg-v1.2.3-linux-x64.tar.gz
```

Use `@` to refer to the context value in parameters:

```js
const context = {
  hash: crypto.randomBytes(16).toString("hex"),
  slice: (str, start, end) => {
    return str.slice(Number(start), Number(end));
  },
  cfg: {
    length: 8,
    defaultExt: "txt",
  },
};

strformat("[hash|slice:0,@cfg.length].[ext|:@cfg.defaultExt]", context);
// 3fabaf5c.txt
```

## Error handling

strformat throws an instance of `StrformatError` when it cannot render a
template. The error contains the following fields:

- `message`: reason why the render fails
- `code`: one of strformat error codes
- `pattern`: a specific pattern that causes the render to fail

Possible error codes (see `StrformatErrorCode`):

| Error code | Description                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------- |
| 101        | The context value for a given key is `undefined`                                            |
| 102        | strformat expects the context value for a given key is a function, but it is not a function |
| 103        | A pipe sequence evaluates to `undefined`                                                    |

## Performance

`strformat` is faster than most other templating engines without precompilation
(generating optimized JavaScript function from the template).

Consider using precompiled templates if the template is known in advance, or you
want to render the same template a large number of times.

- clk: ~5.39 GHz
- cpu: 13th Gen Intel(R) Core(TM) i9-13900HX
- runtime: bun 1.1.34 (x64-linux)

| benchmark        | avg              | min         | p75         | p99         | max         |
| ---------------- | ---------------- | ----------- | ----------- | ----------- | ----------- |
| strformat        | `774.80 ns/iter` | `724.85 ns` | `777.68 ns` | `  1.05 µs` | `  1.15 µs` |
| dot              | `  1.75 µs/iter` | `  1.58 µs` | `  1.85 µs` | `  2.24 µs` | `  2.25 µs` |
| dot (precompile) | `188.91 ps/iter` | `181.15 ps` | `182.62 ps` | `189.94 ps` | `123.89 ns` |
| eta              | `  4.61 µs/iter` | `  4.26 µs` | `  4.73 µs` | `  5.03 µs` | `  5.09 µs` |
| eta (precompile) | ` 48.79 ns/iter` | ` 40.69 ns` | ` 44.02 ns` | `225.83 ns` | `429.49 ns` |
| ejs              | `  8.55 µs/iter` | `  5.80 µs` | `  8.22 µs` | ` 28.65 µs` | `  1.79 ms` |
| ejs (precompile) | `476.49 ns/iter` | `442.47 ns` | `475.12 ns` | `733.37 ns` | `827.39 ns` |
