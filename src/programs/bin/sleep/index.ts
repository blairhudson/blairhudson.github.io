import type { Program } from "../types";

export const sleep: Program = {
  name: "sleep",
  help: "usage: sleep <seconds>",
  run: (args) => ({ lines: [`sleep: ${args[0] ?? 1}s complete`] })
};
