import { installPackage } from "../../../os/kernel/packages";
import type { Program } from "../types";

export const brew: Program = {
  name: "brew",
  help: "usage: brew install <package>",
  run: (args, context) => {
    if (args[0] !== "install") return { lines: ["brew: try brew install paint"] };
    const pkg = args[1];
    if (!pkg) return { lines: ["brew: missing package"] };
    installPackage(pkg, "brew");
    context.launchApp("packageManager");
    return { lines: [`${pkg}: poured into /Applications`, `${pkg}: linked into /bin`] };
  }
};
