import { emptyTrash, findNode, FS_CHANGED_EVENT, restoreNode } from "../../os/kernel/filesystem";
import { append, bindButtonAction, el, icon, subtleButton } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

export const trashManifest: AppManifest = {
  id: "trash",
  name: "Trash",
  icon: "ph-trash",
  defaultSize: { width: 620, height: 520 },
  render: (context) => {
    const root = el("section", "grid h-full grid-rows-[auto_1fr] gap-4 p-5 text-white");
    const header = el("div", "flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/15 bg-white/10 p-4");
    const empty = el("button", "rounded-full bg-red-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-red-300 max-sm:min-h-11 max-sm:px-5", { type: "button", text: "Empty Trash" });
    const list = el("div", "grid content-start gap-2 overflow-auto");

    function bindAction(button: HTMLButtonElement, action: () => void) {
      bindButtonAction(button, (event) => {
        event.stopPropagation();
        action();
      });
    }

    function render() {
      const items = [...(findNode("/Trash")?.children ?? [])];
      list.replaceChildren();
      if (!items.length) {
        list.append(el("p", "rounded-3xl border border-white/10 bg-black/20 p-5 text-white/60", { text: "Trash empty. Suspiciously productive." }));
        return;
      }
      items.forEach((item) => {
        const row = el("div", "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-3xl border border-white/10 bg-black/20 p-3 max-sm:grid-cols-[auto_1fr] max-sm:[&>button]:col-span-2");
        const restore = el("button", `${subtleButton} max-sm:min-h-11`, { type: "button", text: "Restore" });
        bindAction(restore, () => {
          const restoredPath = restoreNode(item.path);
          if (restoredPath.startsWith("/") && findNode(restoredPath)) {
            context.notify(`${item.name} restored to ${restoredPath}`, { label: "Go to File", action: () => context.launchApp("files", { path: restoredPath }) });
          }
          else context.notify(`Restore failed: ${restoredPath}`);
          render();
        });
        append(row, [
          icon(item.icon, "text-2xl text-red-200"),
          append(el("span", "min-w-0"), [el("span", "block truncate text-sm text-white/75", { text: item.name }), el("span", "block truncate font-mono text-xs text-white/35", { text: item.originalPath || "unknown origin" })]),
          restore
        ]);
        list.append(row);
      });
    }

    bindAction(empty, () => {
      const error = emptyTrash();
      context.notify(error ? `Empty Trash failed: ${error}` : "Trash emptied");
      render();
    });
    window.addEventListener(FS_CHANGED_EVENT, render);
    append(header, [el("div", "font-bold", { text: "Deleted artifacts" }), empty]);
    append(root, [header, list]);
    render();
    return root;
  }
};
