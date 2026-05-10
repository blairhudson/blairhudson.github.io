import { createNode, findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const touch: Program = {
  name: "touch",
  help: "usage: touch <path>",
  run: (args, context) => {
    const target = args[0];
    if (!target) return { lines: ["touch: missing path"] };
    const path = normalizePath(target, context.cwd);
    if (findNode(path)) return { lines: [`touched ${path}`] };
    const error = createNode(path, "document", "");
    return { lines: [error ? `touch: ${error}` : `created ${path}`] };
  }
};
