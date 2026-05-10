import type { Program } from "../types";

export const reboot: Program = {
  name: "reboot",
  help: "usage: reboot",
  run: () => {
    window.setTimeout(() => window.location.reload(), 600);
    return { lines: ["syncing fake disks", "rebooting BlairOS v2..."] };
  }
};
