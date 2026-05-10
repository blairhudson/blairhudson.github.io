import type { Program } from "../types";

export const sh: Program = {
  name: "sh",
  help: "usage: sh",
  run: () => ({ lines: ["BlairOS shell already active. Scripts not supported in this terminal."] })
};
