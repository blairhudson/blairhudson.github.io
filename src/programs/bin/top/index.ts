import { processes } from "../../../os/kernel/processes";
import type { Program } from "../types";

export const top: Program = {
  name: "top",
  help: "usage: top",
  run: () => ({ lines: ["PID      CPU  MEM  COMMAND", ...processes.get().map((process, index) => `${process.id.padEnd(8)} ${String(3 + index * 2).padStart(2)}%  ${String(18 + index * 5).padStart(2)}M  ${process.title}`)] })
};
