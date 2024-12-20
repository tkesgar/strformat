#!/usr/bin/env node
import { program } from "commander";
import {
  description as pkgDescription,
  version as pkgVersion,
} from "../package.json";
import { strformat, strformatfs } from "@tkesgar/strformat";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import dayjs from "dayjs";
import { StrformatError } from "@tkesgar/strformat";

program
  .name("strformat")
  .description(pkgDescription)
  .version(pkgVersion)
  .argument("<input-template>", "Template to be rendered")
  .option("-f, --file [FILE]", "provides additional file context")
  .option("-s, --safe", "use filesystem-safe variant")
  .option("--ignore-stdin", "ignore reading context from standard input")
  .option("--print-context", "prints the context to stderr")
  .option("--print-newline", "prints additional newline at the end of string")
  .parse();

const args = program.args;
const opts: {
  file?: string;
  safe?: boolean;
  printContext?: boolean;
  printNewline?: boolean;
  ignoreStdin?: boolean;
} = program.opts();

const [template] = args;

const contextFromInput: Record<string, unknown> | undefined = (() => {
  // Detect if node receives stdin
  // https://stackoverflow.com/questions/39801643/detect-if-node-receives-stdin
  if (process.stdin.isTTY) {
    // Interactive, do not read stdin
    return;
  }

  // Ignore if ignore stdin is provided
  if (opts.ignoreStdin) {
    return;
  }

  try {
    const json = fs.readFileSync(process.stdin.fd, "utf-8").trim();
    return JSON.parse(json);
  } catch {
    console.error("Failed to parse additional context from standard input");
    process.exit(1);
  }
})();

type StrformatContextFn = (...args: string[]) => unknown;

function defineContextFn(fn: StrformatContextFn) {
  return fn;
}

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
  os: {
    arch: os.arch(),
    hostname: os.hostname(),
    machine: os.machine(),
    platform: os.platform(),
    release: os.release(),
    type: os.type(),
    version: os.version(),
  },

  // env: Environment variables
  //
  // [env.USER] = tkesgar
  // [env.WSL_DISTRO_NAME] = Ubuntu-24.04
  env: process.env,

  // version: Node.js version
  // https://nodejs.org/api/process.html#processversion
  //
  // [version] = v22.6.0
  version: process.version,

  // ts: Current timestamp in UNIX seconds
  //
  // [ts] = 1734688483
  ts: Math.floor(Date.now() / 1000),

  // uuid: Returns a random UUIDv4
  // https://nodejs.org/api/crypto.html#cryptorandomuuidoptions
  //
  // [uuid] = bc4218da-75e1-4177-a183-67c7f62d1ee2
  uuid: defineContextFn(() => crypto.randomUUID()),

  // random: Returns a cryptographically random string of specific length (default: 16 bytes)
  //
  // [random]        = 42f6f22fedea4227bcfcbac5e6c5698d
  // [random:4]      = e7bc15ef
  // [random:8,b64]  = SFO+CaRQ0Tc=
  // [random:8,b64u] = SFO-CaRQ0Tc
  random: defineContextFn((_length?, _encoding?) => {
    const buffer = crypto.randomBytes(Number(_length) || 16);

    switch (_encoding) {
      case "b64":
        return buffer.toString("base64");
      case "b64u":
        return buffer.toString("base64url");
      default:
        return buffer.toString("hex");
    }
  }),

  // n: Converts a string into number in base N (default: 10)
  //
  // [|:100|n]    = 100
  // [|:100|n:2]  = 1100100
  // [|:100|n:32] = 34
  n: defineContextFn((_string, _radix?) => {
    const value = Number(_string) || undefined;
    const radix = Number(_radix) || undefined;
    return value?.toString(radix);
  }),

  // n2, n8, n16, n36: same as n:2, n:8, n:16, n:36
  n2: defineContextFn((_string) => {
    const value = Number(_string) || undefined;
    return value?.toString(2);
  }),
  n8: defineContextFn((_string) => {
    const value = Number(_string) || undefined;
    return value?.toString(8);
  }),
  n16: defineContextFn((_string) => {
    const value = Number(_string) || undefined;
    return value?.toString(16);
  }),
  n36: defineContextFn((_string) => {
    const value = Number(_string) || undefined;
    return value?.toString(36);
  }),

  // hex: Converts a string into hex
  //
  // [|:hello|hex] = 68656c6c6f
  hex: defineContextFn((_string) => Buffer.from(_string).toString("hex")),

  // b64: Converts a string into Base 64
  //
  // [|:hello world|b64] = aGVsbG8gd29ybGQ=
  b64: defineContextFn((_string) => Buffer.from(_string).toString("base64")),

  // b64u: Converts a string into Base 64 URL
  //
  // [|:hello world|b64u] = aGVsbG8gd29ybGQ
  b64u: defineContextFn((_string) =>
    Buffer.from(_string).toString("base64url"),
  ),

  // b64_decode: Converts a Base 64 string into UTF-8
  //
  // [|:aGVsbG8gd29ybGQ=|b64_decode] = hello world
  b64_decode: defineContextFn((_string) =>
    Buffer.from(_string, "base64").toString("utf8"),
  ),

  // b64u_decode: Converts a Base 64 URL string into UTF-8
  //
  // [|:aGVsbG8gd29ybGQ|b64u_decode] = hello world
  b64u_decode: defineContextFn((_string) =>
    Buffer.from(_string, "base64url").toString("utf8"),
  ),

  // uri: Encodes a string for use as URI component
  //
  // [|:?foo=bar&baz=👍|uri] = %3Ffoo%3Dbar%26baz%3D%F0%9F%91%8D
  uri: defineContextFn((_string) => encodeURIComponent(_string)),

  // uri_decode: Deccodes a string from URI component
  //
  // [|:%3Ffoo%3Dbar%26baz%3D%F0%9F%91%8D|uri_decode] = ?foo=bar&baz=👍
  uri_decode: defineContextFn((_string) => decodeURIComponent(_string)),

  // slice: Gets a slice of the string
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice
  //
  // [|:R-301 Carbine|slice]       = R-301 Carbine
  // [|:R-301 Carbine|slice:6]     = Carbine
  // [|:R-301 Carbine|slice:6,9]   = Car
  // [|:R-301 Carbine|slice:2,-8]  = 301
  // [|:R-301 Carbine|slice:-7]    = Carbine
  // [|:R-301 Carbine|slice:-7,-3] = Carb
  slice: defineContextFn((_string, _start?, _end?) => {
    const start = Number(_start) || undefined;
    const end = Number(_end) || undefined;
    return _string.slice(start, end);
  }),

  // upper: Converts a string into uppercase
  //
  // [|:hello|upper] = HELLO
  upper: defineContextFn((_string) => _string.toUpperCase()),

  // lower: Converts a string into lowercase
  //
  // [|:HELLO|lower] = hello
  lower: defineContextFn((_string) => _string.toLowerCase()),

  // trim: Trims whitespaces from string
  // [|:  hello  |trim] = hello
  trim: defineContextFn((_string) => _string.trim()),

  // slug: Converts all non-word characters (excluding _) into -
  // [|:Pekerja Ini Menjawab _👍_ Ke Bosnya|slug] = Pekerja-Ini-Menjawab-_--_-Ke-Bosnya
  slug: defineContextFn((_string) => _string.replaceAll(/\W/g, "-")),

  // now: Gets current time with optional formatting
  // Format: https://day.js.org/docs/en/display/format
  // Use < and > for escaping characters instead of [ and ]
  //
  // [now]                     = 2024-12-20T17:29:14+07:00
  // [now:YYYY<Y>-MM<M>-DD<D>] = 2024Y-12M-20D
  now: defineContextFn((_format?: string) => {
    return dayjs().format(_format?.replaceAll("<", "[").replaceAll(">", "]"));
  }),

  // day: Parses a string and prints it with optional formatting
  // Format: https://day.js.org/docs/en/display/format
  // Use < and > for escaping characters instead of [ and ]
  //
  // [|:2020-10-10|day]                     = 2020-10-10T00:00:00+07:00
  // [|:2020-10-10|day:YYYY<Y>-MM<M>-DD<D>] = 2020Y-10M-10D
  day: defineContextFn((_string, _format?: string) => {
    return dayjs(_string).format(
      _format?.replaceAll("<", "[").replaceAll(">", "]"),
    );
  }),

  // unix_day: Parses a string as UNIX timestamp and prints it with optional formatting
  // Format: https://day.js.org/docs/en/display/format
  // Use < and > for escaping characters instead of [ and ]
  //
  // [|:1734682185|nday]                     = 2020-10-10T00:00:00+07:00
  // [|:1734682185|nday:YYYY<Y>-MM<M>-DD<D>] = 2020Y-10M-10D
  unix_day: defineContextFn((_string, _format?: string) => {
    const ts = Number(_string) * 1000;
    return dayjs(ts).format(_format?.replaceAll("<", "[").replaceAll(">", "]"));
  }),

  // Additional context if file path provided (-f path/to/file)
  ...(opts.file &&
    (() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let stat: fs.Stats;
      try {
        stat = fs.statSync(opts.file);
      } catch (error: any) {
        console.error(`Failed to open ${opts.file}: ${error.message}`);
        process.exit(1);
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */

      return {
        // filename: Contains the file name
        //
        // File: /path/to/myfile.txt
        // [filename] = myfile.txt
        filename: path.basename(opts.file),

        // basename: Contains the file name without extension
        //
        // File: /path/to/myfile.txt
        // [basename] = myfile
        basename: path.basename(opts.file, path.extname(opts.file)),

        // dir: Contains the file directory name without extension
        //
        // File: /path/to/myfile.txt
        // [dir] = /path/to
        dir: path.dirname(opts.file),

        // ext: Contains the file extension without dot (.)
        //
        // File: /path/to/myfile.txt
        // [ext] = txt
        ext: path.extname(opts.file).slice(1),

        // atime, mtime, ctime: Contains access time, modified time, and changed time for the file
        // https://nodejs.org/api/fs.html#class-fsstats
        //
        // File: /path/to/myfile.txt
        // [atime|unix_day:YYYY-MM-DD] = 2024-12-20
        // [mtime|unix_day:YYYY-MM-DD] = 2024-12-18
        // [ctime|unix_day:YYYY-MM-DD] = 2024-12-16
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime,

        // Additional context if file path is actually a file (not a directory)
        ...(stat.isFile() && {
          // size: Contains file size in bytes
          //
          // File: /path/to/myfile.txt
          // [size] = 123456
          size: stat.size,

          // hash: Generates the file hash
          // Algorithms: md5 (default), sha1, sha256
          // Encodings: hex (default), b64 (Base64), b64u (Base64 URL)
          //
          // File: /path/to/myfile.txt
          // [hash]            = 6d76ee4ea98594eaa58793a38697fed7
          // [hash:sha256]     = 7e0d986334516a601466ad1b1c7277e4e7d7f17dd1f4adf7c2e96a67bc54cc8b
          // [hash:sha256,b64] = fg2YYzRRamAUZq0bHHJ35OfX8X3R9K33wulqZ7xUzIs=
          hash: defineContextFn((_algorithm?, _encoding?) => {
            const algorithm = (() => {
              switch (_algorithm) {
                case "md5":
                case "sha1":
                case "sha256":
                  return _algorithm;
                default:
                  return "md5";
              }
            })();

            const data = fs.readFileSync(opts.file!);
            ///@ts-expect-error: createHash should accept Buffer
            const hash = crypto.createHash(algorithm).update(data).digest();

            switch (_encoding) {
              case "b64":
                return hash.toString("base64");
              case "b64u":
                return hash.toString("base64url");
              case "hex":
              default:
                return hash.toString("hex");
            }
          }),

          // Returns the file content itself
          //
          // File: /path/to/myfile.txt
          // [content] = Hello, world!
          content: defineContextFn(() => {
            return fs.readFileSync(opts.file!, { encoding: "utf-8" }).trim();
          }),
        }),
      };
    })()),
  // Adds context from standard input, overriding existing values
  ...contextFromInput,
};

if (opts.printContext) {
  process.stderr.write(JSON.stringify(context, null, 2) + "\n");
}

const strformatFn = opts.safe ? strformatfs : strformat;

try {
  const result = strformatFn(template, context);
  process.stdout.write(result);
} catch (error) {
  if (error instanceof StrformatError) {
    console.error(`Failed to render strformat template: ${error.message}`);
    console.error(`Pattern: ${error.pattern}`);
    console.error(`Code: ${error.code}`);
  } else {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    console.error(
      `Error when rendering strformat template: ${(error as any).message}`,
    );
    console.error(`This might be a bug in strformat; please report it.`);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  process.exit(1);
}
if (opts.printNewline) {
  process.stdout.write("\n");
}
