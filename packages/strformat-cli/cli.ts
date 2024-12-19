import { program } from "commander";
import pkg from "./package.json";
import { strformat, strformatfs } from "@tkesgar/strformat";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import dayjs from "dayjs";

program
  .name("strformat")
  .description(pkg.description)
  .version(pkg.version)
  .argument("[input-template]", "Template to be rendered")
  .option("-f, --file [FILE]", "provides additional file context")
  .option("-s, --safe", "use filesystem-safe variant")
  .option("--print-context", "prints the context to stderr")
  .option("--print-newline", "prints additional newline at the end of string");

program.parse();

const args = program.args;
const opts: {
  file?: string;
  safe?: boolean;
  printContext?: boolean;
  printNewline?: boolean;
} = program.opts();

const input = args[0] || fs.readFileSync(process.stdin.fd, "utf-8").trim();

type StrformatContextFn = (...args: string[]) => unknown;

function defineContextFn(fn: StrformatContextFn) {
  return fn;
}

const context = {
  os: {
    arch: os.arch(),
    hostname: os.hostname(),
    machine: os.machine(),
    platform: os.platform(),
    release: os.release(),
    type: os.type(),
    version: os.version(),
  },
  env: process.env,
  version: process.version,
  ts: Math.floor(Date.now() / 1000),
  uuid: defineContextFn(() => crypto.randomUUID()),
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
  n: defineContextFn((_string, _radix?) => {
    const value = Number(_string) || undefined;
    const radix = Number(_radix) || undefined;
    return value?.toString(radix);
  }),
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
  hex: defineContextFn((_string) => Buffer.from(_string).toString("hex")),
  b64: defineContextFn((_string) => Buffer.from(_string).toString("base64")),
  b64u: defineContextFn((_string) =>
    Buffer.from(_string).toString("base64url"),
  ),
  uriencode: defineContextFn((_string) => encodeURIComponent(_string)),
  uridecode: defineContextFn((_string) => decodeURIComponent(_string)),
  slice: defineContextFn((_string, _start?, _end?) => {
    const start = Number(_start) || undefined;
    const end = Number(_end) || undefined;
    return _string.slice(start, end);
  }),
  upper: defineContextFn((_string) => _string.toUpperCase()),
  lower: defineContextFn((_string) => _string.toLowerCase()),
  trim: defineContextFn((_string) => _string.trim()),
  slug: defineContextFn((_string) => _string.replaceAll(/\W/g, "-")),
  now: defineContextFn((_format?: string) => {
    return dayjs().format(_format?.replaceAll("<", "[").replaceAll(">", "]"));
  }),
  day: defineContextFn((_string, _format?: string) => {
    return dayjs(_string).format(
      _format?.replaceAll("<", "[").replaceAll(">", "]"),
    );
  }),
  ...(opts.file &&
    (() => {
      const stat = fs.statSync(opts.file);

      return {
        filename: path.basename(opts.file),
        basename: path.basename(opts.file, path.extname(opts.file)),
        dir: path.dirname(opts.file),
        absdir: path.resolve(path.dirname(opts.file)),
        ext: path.extname(opts.file).slice(1),
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime,
        ...(stat.isFile() && {
          size: stat.size,
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
          content: defineContextFn(() => {
            return fs.readFileSync(opts.file!, { encoding: "utf-8" }).trim();
          }),
        }),
      };
    })()),
};

if (opts.printContext) {
  process.stderr.write(JSON.stringify(context, null, 2) + "\n");
}

const strformatFn = opts.safe ? strformatfs : strformat;
const result = strformatFn(input, context);
process.stdout.write(result);
if (opts.printNewline) {
  process.stdout.write("\n");
}
