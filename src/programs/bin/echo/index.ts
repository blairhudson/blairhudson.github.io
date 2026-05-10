import type { Program } from "../types";

export const echo: Program = {
  name: "echo",
  help: "usage: echo [text ...]",
  run: (args) => ({ lines: [args.join(" ")] })
};
