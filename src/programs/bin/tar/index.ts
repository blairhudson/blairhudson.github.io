import type { Program } from "../types";

export const tar: Program = {
  name: "tar",
  help: "usage: tar <flags> <archive> [files...]",
  run: (args) => ({ lines: args.length ? [`tar: archive ${args.join(" ")} ready`] : ["tar: missing archive"] })
};
