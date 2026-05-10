import type { Program } from "../types";

export const edit: Program = {
  name: "edit",
  help: "usage: edit [file]",
  run: (args, context) => {
    context.launchApp("editor", args[0] ? { path: args[0].startsWith("/") ? args[0] : `${context.cwd}/${args[0]}` } : undefined);
    return { lines: [args[0] ? `editing ${args[0]}` : "opening Text Editor"] };
  }
};
