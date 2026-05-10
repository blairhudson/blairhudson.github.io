import { installedPackages } from "../../../os/kernel/packages";
import type { Program } from "../types";

export const paint: Program = {
  name: "paint",
  help: "usage: paint",
  run: (_args, context) => {
    if (!installedPackages().some((pkg) => pkg.name === "paint")) return { lines: ["paint: not installed", "try: brew install paint"] };
    context.launchApp("paint");
    return { lines: ["opening Paint.app"] };
  }
};
