# @tkesgar/strformat

strformat is a minimal string templating engine, intended for short strings such as generating file names and very simple documents.

It is inspired by Webpack template strings, with additional features such as pipes and default values.

## Usage

### Use in code

Install from NPM:

```
npm install @tkesgar/strformat
```

Use in code:

```
import { strformat } from "@tkesgar/strformat"

console.log(strformat('script.[hash].[ext]', {
  hash: 'abcd1234',
  ext: 'txt'
}))
```

### CLI

Install globally:

```
npm install -g @tkesgar/strformat
```

Use in CLI:

```
my-js-compiler input.myfile -o $(strformat "script.[day:YYYY-MM-DD].js")
```

## Template specification

Simple rendering:

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
  random: () => crypto.randomBytes(16).toString('hex'),
  ext: "txt",
}

strformat("[random].[ext]", context)
// 8c8ccdbfa2ebb57609eec9e82a9e6810.txt
```

Context value function can receive parameters:

```js
const context = {
  random(_len, _enc) {
    const len = Number(_len) || 16
    const enc = ['hex', 'base64', 'base64url'].includes(_enc) ? _enc : 'hex'

    return crypto.randomBytes(Number(len) || 16).toString(enc)
  },
  ext: "txt"
}

strformat("[random].[ext]", context)
// a9ca8061ed985c9f82ab635939b710b4.txt
strformat("[random:8].[ext]", context)
// 81b9d5eecaf5d918.txt
strformat("[random:8,base64url].[ext]", context)
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
  upper: str => str.toUpperCase(),
}

strformat(".env.[env|:development|upper]", context)
// .env.DEVELOPMENT

context.env = 'production'
strformat(".env.[env|:development|upper]", context)
// .env.PRODUCTION
```

Use `.` to traverse through value in the context:

```js
const context = {
  pkg: {
    name: 'mypkg',
    version: '1.2.3',
  },
  node: {
    os,
    process,
  },
  prepend: (str, prefix) => str && prefix + str
}

strformat("[pkg.name]-v[pkg.version]-[node.process.platform]-[node.os.arch][compiler|:|prepend:-].tar.gz", context)
// mypkg-v1.2.3-linux-x64.tar.gz
```

Use `@` to refer to the context value in parameters:

```js
const context = {
  hash: crypto.randomBytes(16).toString('hex'),
  slice: (str, start, end) => {
    return str.slice(Number(start), Number(end))
  },
  cfg: {
    length: 8,
    defaultExt: 'txt'
  }
}

strformat("[hash|slice:0,@cfg.length].[ext|:@cfg.defaultExt]", context)
// 3fabaf5c.txt
```
