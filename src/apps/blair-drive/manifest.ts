import { append, button, el, subtleButton } from "../../os/kernel/dom";
import { flattenFs, FS_CHANGED_EVENT } from "../../os/kernel/filesystem";
import type { FsNode } from "../../os/data/filesystem";
import type { AppContext, AppManifest } from "../../os/kernel/types";

function nodeSize(node: FsNode) {
  return node.body?.length ?? node.href?.length ?? node.children?.length ?? 1;
}

function openNode(node: FsNode, launchApp: AppContext["launchApp"]) {
  if (node.href) launchApp("browser", { url: node.href });
  else if (node.type === "folder") launchApp("files", { path: node.path });
  else if (node.type === "document") launchApp(/\.(md|html?|png|jpe?g|gif|webp|svg|pdf)$/i.test(node.name) ? "preview" : "editor", { path: node.path });
}

export const blairDriveManifest: AppManifest = {
  id: "blairDrive",
  name: "BlairDrive",
  icon: "ph-cloud-check",
  defaultSize: { width: 860, height: 580 },
  render: (context) => {
    let filter: "all" | "documents" | "links" | "folders" = "all";
    const root = el("section", "grid h-full grid-rows-[auto_auto_1fr] gap-4 p-5 text-white");
    const header = el("header", "grid gap-4 rounded-[28px] border border-white/10 bg-black/25 p-5");
    const stats = el("div", "grid gap-3 sm:grid-cols-4");
    const storage = el("div", "h-2 overflow-hidden rounded-full bg-white/10");
    const storageFill = el("span", "block h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300");
    const search = el("input", "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60", { placeholder: "Search synced files" }) as HTMLInputElement;
    const filters = el("div", "flex flex-wrap gap-2");
    const body = el("div", "grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[1fr_240px]");
    const list = el("div", "grid content-start gap-2 overflow-auto rounded-3xl border border-white/10 bg-black/25 p-3");
    const timeline = el("aside", "grid content-start gap-2 overflow-auto rounded-3xl border border-white/10 bg-black/25 p-3");

    function syncedNodes() {
      const query = search.value.trim().toLowerCase();
      return flattenFs()
        .filter((node) => node.path !== "/" && (filter === "all" || (filter === "documents" && node.type === "document") || (filter === "links" && node.type === "link") || (filter === "folders" && node.type === "folder")))
        .filter((node) => !query || `${node.name} ${node.path} ${node.body ?? ""} ${node.href ?? ""}`.toLowerCase().includes(query));
    }

    function stat(label: string, value: string) {
      return append(el("div", "rounded-2xl bg-white/5 p-3"), [el("p", "text-xs uppercase tracking-widest text-white/40", { text: label }), el("p", "mt-1 text-2xl font-black tracking-[-0.06em]", { text: value })]);
    }

    function renderFilters() {
      filters.replaceChildren();
      (["all", "documents", "links", "folders"] as const).forEach((item) => filters.append(button(`${subtleButton} ${filter === item ? "border-cyan-300/50 bg-cyan-300/10" : ""}`, item, () => {
        filter = item;
        render();
      })));
    }

    function render() {
      const all = flattenFs().filter((node) => node.path !== "/");
      const nodes = syncedNodes();
      const used = all.reduce((sum, node) => sum + nodeSize(node), 0);
      const quota = 120_000;
      storageFill.style.width = `${Math.min(100, Math.round((used / quota) * 100))}%`;
      stats.replaceChildren(
        stat("Synced", String(all.length)),
        stat("Documents", String(all.filter((node) => node.type === "document").length)),
        stat("Links", String(all.filter((node) => node.type === "link").length)),
        stat("Used", `${Math.max(1, Math.round(used / 1000))} KB`)
      );
      renderFilters();
      list.replaceChildren();
      nodes.forEach((node) => append(list, [append(el("article", "grid gap-3 rounded-2xl bg-white/5 px-3 py-2 text-sm sm:grid-cols-[1fr_auto] sm:items-center"), [append(el("div", "min-w-0"), [el("p", "truncate font-bold", { text: node.name }), el("p", "truncate font-mono text-xs text-white/35", { text: node.path })]), append(el("div", "flex items-center gap-2"), [el("span", "rounded-full bg-emerald-300/10 px-2 py-1 font-mono text-[0.65rem] text-emerald-200", { text: "synced" }), button("rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20", "Open", () => openNode(node, context.launchApp))])])]));
      timeline.replaceChildren(el("p", "px-2 pb-1 text-xs uppercase tracking-widest text-white/40", { text: "Activity" }));
      all.slice(-8).reverse().forEach((node, index) => timeline.append(append(el("div", "rounded-2xl bg-white/5 p-3 text-sm"), [el("p", "font-bold", { text: node.name }), el("p", "mt-1 text-xs text-white/40", { text: `${index + 1}m ago • ${node.type}` })])));
      if (!nodes.length) list.append(el("p", "p-4 text-sm text-white/55", { text: "No synced items match." }));
    }

    append(storage, [storageFill]);
    append(header, [append(el("div", "flex flex-wrap items-end justify-between gap-3"), [append(el("div"), [el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "BlairDrive" }), el("p", "mt-1 text-sm text-white/60", { text: "Files synced, searchable, versioned, ready on this machine." })]), search]), stats, storage, filters]);
    append(body, [list, timeline]);
    append(root, [header, body]);
    search.addEventListener("input", render);
    window.addEventListener(FS_CHANGED_EVENT, render);
    render();
    return root;
  }
};
