import { createStrformat } from "./strformat"

export { createStrformat, type Strformat } from "./strformat"

export const strformat = createStrformat()

export const strformatfs = createStrformat({
  delimiters: {
    call: '!',
    pipe: '#'
  }
})
