import type { Program } from "../types";

export const unzip: Program = {
  name: "unzip",
  help: "usage: unzip <archive>",
  run: (args) => ({ lines: args[0] ? [`Archive: ${args[0]}`, "inflating files"] : ["unzip: missing archive"] })
};
