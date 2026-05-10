import type { Program } from "../types";

export const uname: Program = {
  name: "uname",
  help: "usage: uname [-a]",
  run: (args) => ({ lines: [args.includes("-a") ? "BlairOS blairhudson.github.io 2.0 local-web arm64" : "BlairOS"] })
};
