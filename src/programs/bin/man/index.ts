import { findNode } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const man: Program = {
  name: "man",
  help: "usage: man <program>",
  run: (args) => {
    const target = args[0];
    if (!target) return { lines: ["What manual page do you want?"] };
    if (!findNode(`/bin/${target}`)) return { lines: [`No manual entry for ${target}`] };
    return { lines: [`${target}(1)`, "BlairOS command. Run with --help for usage.", "Filesystem changes persist on this machine."] };
  }
};
