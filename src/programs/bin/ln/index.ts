import { copyNode } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const ln: Program = {
  name: "ln",
  help: "usage: ln <source> <target>",
  run: (args, context) => {
    const [source, target] = args.filter((arg) => arg !== "-s");
    if (!source || !target) return { lines: ["ln: missing source or target"] };
    const error = copyNode(source.startsWith("/") ? source : `${context.cwd}/${source}`, target.startsWith("/") ? target : `${context.cwd}/${target}`);
    return { lines: [error ?? `${target} linked`] };
  }
};
