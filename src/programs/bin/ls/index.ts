import { listChildren, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const ls: Program = {
  name: "ls",
  help: "usage: ls [path]",
  run: (args, context) => {
    const path = normalizePath(args[0] ?? context.cwd, context.cwd);
    const children = listChildren(path);
    return { lines: children.length ? children.map((node) => node.name) : [`ls: ${path}: no such directory or empty folder`] };
  }
};
