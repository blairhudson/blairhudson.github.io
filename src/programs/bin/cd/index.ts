import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const cd: Program = {
  name: "cd",
  help: "usage: cd <path>",
  run: (args, context) => {
    const path = normalizePath(args[0] ?? "/Home/blair", context.cwd);
    const node = findNode(path);
    if (!node || node.type !== "folder") return { lines: [`cd: ${path}: not a directory`] };
    context.setCwd(path);
    return { lines: [] };
  }
};
