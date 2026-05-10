import { createNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const mkdir: Program = {
  name: "mkdir",
  help: "usage: mkdir <path>",
  run: (args, context) => {
    const target = args[0];
    if (!target) return { lines: ["mkdir: missing path"] };
    const error = createNode(normalizePath(target, context.cwd), "folder");
    return { lines: [error ? `mkdir: ${error}` : `created ${normalizePath(target, context.cwd)}`] };
  }
};
