import type { Program } from "../types";

export const alias: Program = {
  name: "alias",
  help: "usage: alias [name=value]",
  run: (args) => ({ lines: args.length ? args.map((arg) => `alias ${arg}`) : ["alias ll='ls'", "alias edit='open text editor'", "alias www='open browser'"] })
};
