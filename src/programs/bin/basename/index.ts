import { normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const basename: Program = {
  name: "basename",
  help: "usage: basename <path>",
  run: (args, context) => {
    const path = normalizePath(args[0] ?? context.cwd, context.cwd);
    return { lines: [path.split("/").filter(Boolean).at(-1) ?? "/"] };
  }
};
