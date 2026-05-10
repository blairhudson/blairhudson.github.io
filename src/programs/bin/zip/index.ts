import type { Program } from "../types";

export const zip: Program = {
  name: "zip",
  help: "usage: zip <archive> <files...>",
  run: (args) => ({ lines: args.length >= 2 ? [`adding: ${args.slice(1).join(", ")}`, `${args[0]} written`] : ["zip: missing archive or files"] })
};
