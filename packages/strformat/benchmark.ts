import { run, bench } from 'mitata';
import { strformat } from '.';
import crypto from 'node:crypto'

const ctx = {
  filename: 'MyNamespace~my-app-script',
  hash: crypto.randomBytes(16).toString('hex'),
  ext: 'js',
  slice: (_string: any, _start?: any, _end?: any) => {
    const start = Number(_start) || undefined
    const end = Number(_end) || undefined
    return _string.slice(start, end)
  },
  config: {
    default: 'default'
  }
}

let largeString = crypto.randomBytes(1000).toString('base64')
largeString = largeString.slice(0, 100) + '[filename]' + largeString.slice(100)
largeString = largeString.slice(0, 200) + '[hash]' + largeString.slice(200)
largeString = largeString.slice(0, 300) + '[ext]' + largeString.slice(300)
largeString = largeString.slice(0, 400) + '[filehash|:@config.default|slice:0,3]' + largeString.slice(400)

bench('simple', () => {
  strformat('[filename].[hash].[ext]', ctx)
})

bench('complex', () => {
  strformat('[unknown|:@config.default|slice:0,3].[ext]', ctx)
})

bench('large', () => {
  strformat(largeString, ctx)
})

await run()
