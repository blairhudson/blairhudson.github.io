import { processes } from "../../../os/kernel/processes";
import type { Program } from "../types";

export const ps: Program = {
  name: "ps",
  help: "usage: ps",
  run: () => ({ lines: ["PID      APP       STATE      TITLE", ...processes.get().map((process) => `${process.id.padEnd(8)} ${process.appId.padEnd(9)} ${(process.minimized ? "sleep" : "run").padEnd(10)} ${process.title}`)] })
};
