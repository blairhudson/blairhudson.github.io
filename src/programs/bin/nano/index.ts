import type { Program } from "../types";

export const nano: Program = {
  name: "nano",
  help: "usage: nano [file]",
  run: (args, context) => {
    if (context.startNano) {
      context.startNano(args[0]);
      return { lines: [] };
    }
    context.launchApp("editor", args[0] ? { path: args[0].startsWith("/") ? args[0] : `${context.cwd}/${args[0]}` } : undefined);
    return { lines: [args[0] ? `editing ${args[0]}` : "opening Text Editor"] };
  }
};
