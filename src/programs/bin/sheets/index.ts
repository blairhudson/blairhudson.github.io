import { normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const sheets: Program = {
  name: "sheets",
  help: "usage: sheets [file.sheet|file.csv]",
  run: (args, context) => {
    const path = args[0] ? normalizePath(args.join(" "), context.cwd) : undefined;
    context.launchApp("sheets", path ? { path } : undefined);
    return { lines: [path ? `opening ${path}` : "opening Sheets.app"] };
  }
};
