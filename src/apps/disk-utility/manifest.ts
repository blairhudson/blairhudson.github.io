import { append, button, el } from "../../os/kernel/dom";
import { emptyTrash, findNode, flattenFs, FS_CHANGED_EVENT, resetFilesystem } from "../../os/kernel/filesystem";
import type { FsNode } from "../../os/data/filesystem";
import type { AppManifest } from "../../os/kernel/types";

function nodeSize(node: FsNode): number {
  return (node.body?.length ?? 0) + (node.href?.length ?? 0) + (node.children ?? []).reduce((sum, child) => sum + nodeSize(child), 0);
}

export const diskUtilityManifest: AppManifest = {
  id: "diskUtility",
  name: "Disk Utility",
  icon: "ph-hard-drive",
  defaultSize: { width: 700, height: 500 },
  render: (context) => {
    const root = el("section", "grid h-full grid-rows-[auto_auto_1fr_auto] gap-4 p-5 text-white");
    const stats = el("div", "grid gap-3 sm:grid-cols-3");
    const list = el("div", "overflow-auto rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/65");
    const render = () => {
      const nodes = flattenFs();
      const trash = findNode("/Trash");
      const trashNodes = trash?.children ?? [];
      const used = nodes.reduce((sum, node) => sum + nodeSize(node), 0);
      stats.replaceChildren();
      [["Volume", "BlairOS"], ["Nodes", String(nodes.length)], ["Used", `${used} B`], ["Trash Items", String(trashNodes.length)], ["Documents", String(nodes.filter((node) => node.type === "document").length)], ["Folders", String(nodes.filter((node) => node.type === "folder" || node.type === "trash").length)]].forEach(([label, value]) => append(stats, [append(el("div", "rounded-3xl border border-white/10 bg-black/20 p-4"), [el("p", "text-xs uppercase tracking-widest text-white/40", { text: label }), el("p", "mt-2 text-2xl font-black", { text: value })])]));
      list.replaceChildren();
      nodes
        .filter((node) => node.path !== "/")
        .toSorted((a, b) => nodeSize(b) - nodeSize(a))
        .slice(0, 24)
        .forEach((node) => append(list, [append(el("div", "grid grid-cols-[1fr_auto] gap-3 border-b border-white/5 py-2 last:border-0"), [el("span", "truncate", { text: node.path }), el("span", "font-mono text-white/40", { text: `${nodeSize(node)} B` })])]) );
    };
    const actions = append(el("div", "flex flex-wrap gap-3"), [
      button("rounded-2xl bg-red-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-red-300", "Empty Trash", () => { const error = emptyTrash(); context.notify(error ?? "Trash emptied"); render(); }),
      button("rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-100", "Reset Volume", () => { resetFilesystem(); context.notify("Filesystem reset"); render(); })
    ]);
    window.addEventListener(FS_CHANGED_EVENT, render);
    new MutationObserver((_, observer) => {
      if (document.body.contains(root)) return;
      window.removeEventListener(FS_CHANGED_EVENT, render);
      observer.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
    append(root, [el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "Disk Utility" }), stats, actions, list, el("p", "text-sm leading-6 text-white/60", { text: "Manage the local BlairOS volume, Trash, and filesystem state." })]);
    render();
    return root;
  }
};
