import type { Program } from "../types";

export const exportProgram: Program = {
  name: "export",
  help: "usage: export NAME=value",
  run: (args) => ({ lines: args.length ? args.map((arg) => `exported ${arg}`) : ["USER=blair", "HOME=/Home/blair", "SHELL=/bin/sh"] })
};
