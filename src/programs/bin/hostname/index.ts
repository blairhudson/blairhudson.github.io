import type { Program } from "../types";

export const hostname: Program = {
  name: "hostname",
  help: "usage: hostname",
  run: () => ({ lines: ["blairhudson.com"] })
};
