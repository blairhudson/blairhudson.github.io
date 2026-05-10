import { installPackage } from "../../../os/kernel/packages";
import type { Program } from "../types";

export const apt: Program = {
  name: "apt",
  help: "usage: apt install <package>",
  run: (args, context) => {
    if (args[0] !== "install") return { lines: ["apt: try apt install weather"] };
    const pkg = args[1];
    if (!pkg) return { lines: ["apt: missing package"] };
    installPackage(pkg, "apt");
    context.launchApp("packageManager");
    return { lines: [`Reading package lists... done`, `${pkg} installed`] };
  }
};
