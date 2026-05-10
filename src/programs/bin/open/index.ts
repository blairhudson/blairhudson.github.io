import { linkAliases } from "../../../os/data/links";
import { findNode, normalizePath } from "../../../os/kernel/filesystem";
import type { AppId } from "../../../os/kernel/types";
import type { Program } from "../types";

const appAliases: Record<string, AppId> = {
  terminal: "terminal",
  browser: "browser",
  code: "code",
  vscode: "code",
  "vs code": "code",
  "visual studio code": "code",
  editor: "editor",
  textedit: "editor",
  "text editor": "editor",
  files: "files",
  finder: "files",
  trash: "trash",
  settings: "settings",
  about: "about",
  "activity monitor": "activityMonitor",
  activity: "activityMonitor",
  profiler: "systemProfiler",
  "system profiler": "systemProfiler",
  console: "console",
  preview: "preview",
  notes: "notes",
  "disk utility": "diskUtility",
  disk: "diskUtility",
  "network utility": "networkUtility",
  network: "networkUtility",
  calculator: "calculator",
  calc: "calculator",
  mail: "mail",
  radio: "radio",
  music: "radio",
  paint: "paint",
  sheets: "sheets",
  spreadsheet: "sheets",
  numbers: "sheets"
};

export const open: Program = {
  name: "open",
  help: "usage: open <app|file|link>",
  run: (args, context) => {
    const target = args.join(" ").trim();
    if (!target) return { lines: ["open targets: apps, files, folders, links"] };
    if (target.toLowerCase() === "pod bay doors") return { lines: ["I'm sorry Blair, I can't do that."] };

    const appId = appAliases[target.toLowerCase()];
    if (appId) {
      context.launchApp(appId);
      return { lines: [`opening ${target}`] };
    }

    const link = linkAliases.get(target.toLowerCase());
    if (link) {
      context.launchApp("browser", { url: link.href });
      return { lines: [`opening ${link.href}`] };
    }

    const node = findNode(normalizePath(target, context.cwd));
    if (node?.appId) {
      context.launchApp(node.appId as AppId);
      return { lines: [`opening ${node.name}`] };
    }
    if (node?.href) {
      context.launchApp("browser", { url: node.href });
      return { lines: [`opening ${node.href}`] };
    }
    if (node?.type === "folder") {
      context.launchApp("files", { path: node.path });
      return { lines: [`opening ${node.path}`] };
    }
    if (node?.type === "document") {
      const appId = /\.(sheet|csv)$/i.test(node.name) ? "sheets" : /\.(js|mjs|cjs|ts|tsx|jsx|json|css)$/i.test(node.name) ? "code" : /\.(html?|png|jpe?g|gif|webp|svg|pdf|md)$/i.test(node.name) ? "preview" : "editor";
      context.launchApp(appId, { path: node.path });
      return { lines: [`opening ${node.path}`] };
    }

    return { lines: [`open: no target named ${target}`] };
  }
};
