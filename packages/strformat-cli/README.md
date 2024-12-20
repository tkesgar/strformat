# @tkesgar/strformat-cli

> CLI for strformat

strformat is a minimal string templating engine, intended for short strings such
as file names. It is inspired by Webpack template strings, with additional
features such as pipes and default values.

See [strformat] for more details about the template.

```
$ my-compiler -o $(strformat [pkg.name]-v[pkg.version]-[node.process.platform]-[node.os.arch][compiler|:|prepend:-].tar.gz)
Compiling... done.
Building archive... done.
Written output to mypkg-v1.2.3-linux-x64.tar.gz.
```

## Usage

Install globally from NPM:

```
npm install -g @tkesgar/strformat
bun add -g @tkesgar/format
```

Run in terminal:

```
$ strformat -h
Usage: strformat [options] <input-template>

CLI for strformat

Arguments:
  input-template     Template to be rendered

Options:
  -V, --version      output the version number
  -f, --file [FILE]  provides additional file context
  -s, --safe         use filesystem-safe variant
  --ignore-stdin     ignore reading context from standard input
  --print-context    prints the context to stderr
  --print-newline    prints additional newline at the end of string
  -h, --help         display help for command
```

## Output

Prints the resulting template to standard output:

```sh
$ strformat -f myfile "[hash].[txt]"
# abcd1234.txt
```

Use strformat as part of bash commands in scripts or CI commands:

```sh
$ cp myfile.txt $(strformat -f myfile.txt "public/[basename].[hash].[ext]")
# Copies myfile.txt to public/myfile.abcd1234.txt
```

On error, strformat exits with nonzero, returns empty and prints error message
to standard error.

```sh
$ strformat "[unknown]"
# Failed to render strformat template: Context does not contain 'unknown'
# Pattern: [unknown]
# Code: 101
$ echo $?
# 1
```

## Context data

Context data can be provided from standard input:

```sh
$ cat package.json | strformat "[name] ([version]) - [description]"
# @tkesgar/strformat-cli (1.0.0) - CLI for strformat
```

By default, the program detects if it receives data from standard input. To
ignore this behavior, use `--ignore-stdin` switch.

Default context data:

```ts
const context = {
  // os: Subset of Node os module
  // https://nodejs.org/api/os.html
  //
  // [os.arch]     = x64
  // [os.hostname] = my-laptop
  // [os.machine]  = x86_64
  // [os.platform] = linux
  // [os.release]  = 5.15.155.5-microsoft-standard-WSL2
  // [os.type]     = Linux
  // [os.version]  - #5 SMP Tue Nov 5 00:55:55 UTC 2025

  // env: Environment variables
  //
  // [env.USER] = tkesgar
  // [env.WSL_DISTRO_NAME] = Ubuntu-24.04

  // version: Node.js version
  // https://nodejs.org/api/process.html#processversion
  //
  // [version] = v22.6.0

  // ts: Current timestamp in UNIX seconds
  //
  // [ts] = 1734688483

  // uuid: Returns a random UUIDv4
  // https://nodejs.org/api/crypto.html#cryptorandomuuidoptions
  //
  // [uuid] = bc4218da-75e1-4177-a183-67c7f62d1ee2

  // random: Returns a cryptographically random string of specific length (default: 16 bytes)
  //
  // [random]        = 42f6f22fedea4227bcfcbac5e6c5698d
  // [random:4]      = e7bc15ef
  // [random:8,b64]  = SFO+CaRQ0Tc=
  // [random:8,b64u] = SFO-CaRQ0Tc

  // n: Converts a string into number in base N (default: 10)
  //
  // [|:100|n]    = 100
  // [|:100|n:2]  = 1100100
  // [|:100|n:32] = 34

  // n2, n8, n16, n36: same as n:2, n:8, n:16, n:36

  // hex: Converts a string into hex
  //
  // [|:hello|hex] = 68656c6c6f

  // b64: Converts a string into Base 64
  //
  // [|:hello world|b64] = aGVsbG8gd29ybGQ=

  // b64u: Converts a string into Base 64 URL
  //
  // [|:hello world|b64u] = aGVsbG8gd29ybGQ

  // b64_decode: Converts a Base 64 string into UTF-8
  //
  // [|:aGVsbG8gd29ybGQ=|b64_decode] = hello world

  // b64u_decode: Converts a Base 64 URL string into UTF-8
  //
  // [|:aGVsbG8gd29ybGQ|b64u_decode] = hello world

  // uri: Encodes a string for use as URI component
  //
  // [|:?foo=bar&baz=👍|uri] = %3Ffoo%3Dbar%26baz%3D%F0%9F%91%8D

  // uri_decode: Deccodes a string from URI component
  //
  // [|:%3Ffoo%3Dbar%26baz%3D%F0%9F%91%8D|uri_decode] = ?foo=bar&baz=👍

  // slice: Gets a slice of the string
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice
  //
  // [|:R-301 Carbine|slice]       = R-301 Carbine
  // [|:R-301 Carbine|slice:6]     = Carbine
  // [|:R-301 Carbine|slice:6,9]   = Car
  // [|:R-301 Carbine|slice:2,-8]  = 301
  // [|:R-301 Carbine|slice:-7]    = Carbine
  // [|:R-301 Carbine|slice:-7,-3] = Carb

  // upper: Converts a string into uppercase
  //
  // [|:hello|upper] = HELLO

  // lower: Converts a string into lowercase
  //
  // [|:HELLO|lower] = hello

  // trim: Trims whitespaces from string
  // [|:  hello  |trim] = hello

  // slug: Converts all non-word characters (excluding _) into -
  // [|:Pekerja Ini Menjawab _👍_ Ke Bosnya|slug] = Pekerja-Ini-Menjawab-_--_-Ke-Bosnya

  // now: Gets current time with optional formatting
  // Format: https://day.js.org/docs/en/display/format
  // Use < and > for escaping characters instead of [ and ]
  //
  // [now]                     = 2024-12-20T17:29:14+07:00
  // [now:YYYY<Y>-MM<M>-DD<D>] = 2024Y-12M-20D

  // day: Parses a string and prints it with optional formatting
  // Format: https://day.js.org/docs/en/display/format
  // Use < and > for escaping characters instead of [ and ]
  //
  // [|:2020-10-10|day]                     = 2020-10-10T00:00:00+07:00
  // [|:2020-10-10|day:YYYY<Y>-MM<M>-DD<D>] = 2020Y-10M-10D

  // unix_day: Parses a string as UNIX timestamp and prints it with optional formatting
  // Format: https://day.js.org/docs/en/display/format
  // Use < and > for escaping characters instead of [ and ]
  //
  // [|:1734682185|nday]                     = 2020-10-10T00:00:00+07:00
  // [|:1734682185|nday:YYYY<Y>-MM<M>-DD<D>] = 2020Y-10M-10D

  // Additional context if file path provided (-f path/to/file)
  ...(opts.file &&
    (() => {
      return {
        // filename: Contains the file name
        //
        // File: /path/to/myfile.txt
        // [filename] = myfile.txt

        // basename: Contains the file name without extension
        //
        // File: /path/to/myfile.txt
        // [basename] = myfile

        // dir: Contains the file directory name without extension
        //
        // File: /path/to/myfile.txt
        // [dir] = /path/to

        // ext: Contains the file extension without dot (.)
        //
        // File: /path/to/myfile.txt
        // [ext] = txt

        // atime, mtime, ctime: Contains access time, modified time, and changed time for the file
        // https://nodejs.org/api/fs.html#class-fsstats
        //
        // File: /path/to/myfile.txt
        // [atime|unix_day:YYYY-MM-DD] = 2024-12-20
        // [mtime|unix_day:YYYY-MM-DD] = 2024-12-18
        // [ctime|unix_day:YYYY-MM-DD] = 2024-12-16

        // Additional context if file path is actually a file (not a directory)
        ...(stat.isFile() &&
          {
            // size: Contains file size in bytes
            //
            // File: /path/to/myfile.txt
            // [size] = 123456
            // hash: Generates the file hash
            // Algorithms: md5 (default), sha1, sha256
            // Encodings: hex (default), b64 (Base64), b64u (Base64 URL)
            //
            // File: /path/to/myfile.txt
            // [hash]            = 6d76ee4ea98594eaa58793a38697fed7
            // [hash:sha256]     = 7e0d986334516a601466ad1b1c7277e4e7d7f17dd1f4adf7c2e96a67bc54cc8b
            // [hash:sha256,b64] = fg2YYzRRamAUZq0bHHJ35OfX8X3R9K33wulqZ7xUzIs=
            // Returns the file content itself
            //
            // File: /path/to/myfile.txt
            // [content] = Hello, world!
          }),
      };
    })()),
};
```

## License

[MIT License](LICENSE)
