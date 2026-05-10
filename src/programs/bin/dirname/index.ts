import { normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const dirname: Program = {
  name: "dirname",
  help: "usage: dirname <path>",
  run: (args, context) => {
    const parts = normalizePath(args[0] ?? context.cwd, context.cwd).split("/").filter(Boolean);
    parts.pop();
    return { lines: [`/${parts.join("/")}` || "/"] };
  }
};
