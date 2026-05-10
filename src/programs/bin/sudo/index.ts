import type { Program } from "../types";

export const sudo: Program = {
  name: "sudo",
  help: "usage: sudo <command>",
  run: (args) => ({
    lines: args.length
      ? ["blair is already root", `audit: '${args.join(" ")}' approved by vibes committee`]
      : ["blair is already root"]
  })
};
