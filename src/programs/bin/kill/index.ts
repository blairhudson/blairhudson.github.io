import { closeProcess, processes } from "../../../os/kernel/processes";
import type { Program } from "../types";

export const kill: Program = {
  name: "kill",
  help: "usage: kill <pid>",
  run: (args) => {
    const pid = args[0];
    if (!pid) return { lines: ["kill: missing pid"] };
    if (!processes.get().some((process) => process.id === pid)) return { lines: [`kill: ${pid}: no such process`] };
    closeProcess(pid);
    return { lines: [`terminated ${pid}`] };
  }
};
