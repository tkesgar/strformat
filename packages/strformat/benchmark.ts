import { run, bench } from 'mitata';
import { strformat } from '.';
import crypto from 'node:crypto'

const ctx = {
  filename: 'MyNamespace~my-app-script',
  hash: crypto.randomBytes(16).toString('hex'),
  ext: 'js'
}

bench('simple', () => {
  strformat('[filename].[hash].[ext]', ctx)
})

await run()
