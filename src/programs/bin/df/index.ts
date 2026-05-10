import { flattenFs } from "../../../os/kernel/filesystem";
import type { Program } from "../types";

export const df: Program = {
  name: "df",
  help: "usage: df",
  run: () => {
    const used = flattenFs().reduce((sum, node) => sum + (node.body?.length ?? 0) + (node.href?.length ?? 0), 0);
    return { lines: ["Filesystem  Size Used Avail Mounted", `blairos     64M  ${used}B  64M  /`] };
  }
};
