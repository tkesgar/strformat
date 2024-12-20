import { createStrformat } from "./strformat";

export {
  createStrformat,
  StrformatError,
  ERROR_CONTEXT_NOT_FOUND,
  ERROR_CONTEXT_NOT_FUNCTION,
  ERROR_PIPE_UNDEFINED,
  type StrformatErrorCode,
  type Strformat,
} from "./strformat";

export const strformat = createStrformat();

export const strformatfs = createStrformat({
  delimiters: {
    call: "!",
    pipe: "#",
  },
});
