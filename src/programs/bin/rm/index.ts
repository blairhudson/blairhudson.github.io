import { normalizePath, removeNode } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const rm: Program = {
  name: "rm",
  help: "usage: rm <path>",
  run: (args, context) => {
    const target = args.at(-1);
    if (!target) return { lines: ["rm: missing path"] };
    const path = normalizePath(target, context.cwd);
    if (path === "/" || args.join(" ").includes("-rf /")) return { lines: ["rm: refused to delete /", "root moved to emotional support Trash instead", "therapy daemon notified"] };
    const error = removeNode(path);
    return { lines: [error ? `rm: ${error}` : `removed ${path}`] };
  }
};
