import { findNode, flattenFs, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const find: Program = {
  name: "find",
  help: "usage: find [path] [name-fragment]",
  run: (args, context) => {
    const path = normalizePath(args[0] ?? context.cwd, context.cwd);
    const query = args[1]?.toLowerCase();
    if (!findNode(path)) return { lines: [`find: ${path}: no such file or directory`] };
    const lines = flattenFs().filter((node) => node.path === path || node.path.startsWith(`${path}/`)).filter((node) => !query || node.name.toLowerCase().includes(query)).map((node) => node.path);
    return { lines };
  }
};
