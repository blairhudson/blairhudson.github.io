import type { Program } from "../types";

export const chown: Program = {
  name: "chown",
  help: "usage: chown <owner> <path>",
  run: (args) => ({ lines: args.length < 2 ? ["chown: missing owner or path"] : [`${args[1]}: owner remains blair`] })
};
