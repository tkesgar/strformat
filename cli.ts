import { program } from "commander"
import pkg from "./package.json"
import { strformat, strformatfs } from ".";
import fs from "node:fs"
import os from "node:os"
import crypto from "node:crypto"
import path from "node:path"

program
  .name('strformat')
  .description(pkg.description)
  .version(pkg.version)
  .argument('[input-template]', 'Template to be rendered')
  .option('-o, --output [FILE]', 'write output to file instead of stdout')
  .option('-f, --file [FILE]', 'provides additional file context')
  .option('-s, --safe', 'use filesystem-safe variant')
  .option('--print-context', 'prints the context to stderr')

program.parse();

const args = program.args
const opts: {
  output?: string
  file?: string
  context?: string
  printContext?: boolean
  safe?: boolean
} = program.opts()

const input = args[0] || fs.readFileSync(process.stdin.fd, 'utf-8').trim()

const context: Record<string, unknown> = {
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
  uuid: () => crypto.randomUUID(),
  random: (_len?: string, _enc?: string) => {
    const buffer = crypto.randomBytes(Number(_len) || 16)

    switch (_enc) {
      case 'b64':
        return buffer.toString('base64')
      case 'b64u':
        return buffer.toString('base64url')
      default:
        return buffer.toString('hex')
    }
  },
  n: (_str: string, radix?: string) => (Number(_str) || undefined)?.toString(Number(radix) || undefined),
  n2: (_str: string) => (Number(_str) || undefined)?.toString(2),
  n8: (_str: string) => (Number(_str) || undefined)?.toString(8),
  n16: (_str: string) => (Number(_str) || undefined)?.toString(16),
  n36: (_str: string) => (Number(_str) || undefined)?.toString(36),
  hex: (_str: string) => Buffer.from(_str).toString('hex'),
  b64: (_str: string) => Buffer.from(_str).toString('base64'),
  b64u: (_str: string) => Buffer.from(_str).toString('base64url'),
  uri: (_str: string) => encodeURIComponent(_str),
  slice: (_str: string, _start: string, _end: string) => {
    const start = Number(_start) || undefined
    const end = Number(_end) || undefined
    return _str.slice(start, end)
  },
  upper: (_str: string) => _str.toUpperCase(),
  lower: (_str: string) => _str.toLowerCase(),
  trim: (_str: string) => _str.trim(),
  slug: (_str: string) => _str.replaceAll(/\W/g, '-'),
  oneline: (_str: string) => _str.replaceAll('\n', '')
}

if (opts.file) {
  const stat = fs.statSync(opts.file)

  Object.assign(context, {
    base: path.basename(opts.file),
    dir: path.dirname(opts.file),
    ext: path.extname(opts.file),
    atime: stat.atime,
    mtime: stat.mtime,
    ctime: stat.ctime,
    ...(stat.isFile() && {
      size: stat.size,
      hash: (_alg?: string, _enc?: string) => {
        const algorithm = (() => {
          switch (_alg) {
            case 'md5':
            case 'sha1':
            case 'sha256':
              return _alg
            default:
              return 'md5'
          }
        })()

        const data = fs.readFileSync(opts.file!)
        ///@ts-expect-error: createHash should accept Buffer
        const hash = crypto.createHash(algorithm).update(data).digest()

        switch (_enc) {
          case 'b64':
            return hash.toString('base64')
          case 'b64u':
            return hash.toString('base64url')
          case 'hex':
          default:
            return hash.toString('hex')
        }
      },
      content: (_enc?: string) => {
        const encoding = 'utf-8'
        return fs.readFileSync(opts.file!, { encoding }).trim()
      },
    })
  })
}

const result = opts.safe ? strformatfs(input, context) : strformat(input, context)

if (!opts.output) {
  console.log(result)
} else {
  fs.writeFileSync(opts.output, result, { encoding: 'utf-8' })
}
