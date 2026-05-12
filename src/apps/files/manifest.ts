import { duplicateNode, findNode, FS_CHANGED_EVENT, listChildren, moveNode, normalizePath, removeNode, renameNode, restoreNode } from "../../os/kernel/filesystem";
import { metadataFor, setComment, setTags, toggleFavorite } from "../../os/kernel/metadata";
import { append, bindButtonAction, el, icon, subtleButton } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

const sidebarPaths = ["/Desktop", "/Home/blair", "/Applications", "/Projects", "/Writing", "/Research", "/bin", "/Trash"];

function isSmallScreen() {
  return window.matchMedia("(max-width: 720px)").matches;
}

export const filesManifest: AppManifest = {
  id: "files",
  name: "Files",
  icon: "ph-folder-open",
  defaultSize: { width: 880, height: 610 },
  render: (context) => {
    let path = String(context.process.data?.path || "/Home/blair");
    const root = el("section", "grid h-full grid-cols-[190px_1fr] bg-slate-950/25 text-white max-sm:grid-cols-1");
    const sidebar = el("aside", "border-r border-white/10 p-3 max-sm:hidden");
    const main = el("main", "min-w-0 overflow-auto p-4");
    let selectedPath = "";

    function openPath(nextPath: string) {
      path = normalizePath(nextPath, path);
      render();
    }

    function selectItem(item: HTMLElement, nextPath: string) {
      selectedPath = nextPath;
      main.querySelectorAll("[data-fs-path]").forEach((node) => node.classList.remove("border-cyan-300/40", "bg-cyan-300/10"));
      item.classList.add("border-cyan-300/40", "bg-cyan-300/10");
    }

    function renderSidebar() {
      sidebar.replaceChildren();
      sidebarPaths.forEach((sidebarPath) => {
        const node = findNode(sidebarPath);
        if (!node) return;
        const item = el("button", `${subtleButton} mb-2 flex w-full items-center gap-2 ${path === sidebarPath ? "border-cyan-300/40 bg-cyan-300/15" : ""}`, { type: "button" });
        append(item, [icon(node.icon, "text-xl text-cyan-200"), el("span", "truncate", { text: node.name })]);
        bindButtonAction(item, () => openPath(sidebarPath));
        sidebar.append(item);
      });
    }

    function render() {
      renderSidebar();
      main.replaceChildren();
      const node = findNode(path);
      const header = el("div", "mb-4 flex flex-wrap items-center justify-between gap-3");
      append(header, [
        el("div", "font-mono text-sm text-cyan-100", { text: path }),
        el("button", subtleButton, { type: "button", text: "Up" })
      ]);
      bindButtonAction(header.lastElementChild as HTMLButtonElement, () => openPath(`${path}/..`));
      main.append(header);

      const toolbar = el("div", "mb-4 flex flex-wrap gap-2");
      const selected = () => (selectedPath ? findNode(selectedPath) : undefined);
      const action = (label: string, fn: () => void) => {
        const item = el("button", "rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20 max-sm:min-h-11 max-sm:px-3.5", { type: "button", text: label });
        bindButtonAction(item, (event) => {
          event.stopPropagation();
          fn();
        });
        toolbar.append(item);
      };
      action("Open", () => { const node = selected(); if (node) context.openNode(node); });
      action("Preview", () => { const node = selected(); if (node) context.launchApp("preview", { path: node.path }); });
      action("Open With", () => {
        const node = selected();
        if (!node) return;
        const app = prompt("Open with", "preview, editor, code, browser, mail")?.toLowerCase();
        if (app === "editor") context.launchApp("editor", { path: node.path });
        else if (app === "code") context.launchApp("code", { path: node.path });
        else if (app === "browser") context.launchApp("browser", { url: node.href || node.path });
        else if (app === "mail") context.launchApp("mail", { attachment: node.path });
        else context.launchApp("preview", { path: node.path });
      });
      action("Favorite", () => { if (selectedPath) context.notify(toggleFavorite(selectedPath) ? "Favorited" : "Unfavorited"); render(); });
      action("Tags", () => { if (selectedPath) { const meta = metadataFor(selectedPath); const value = prompt("Tags", (meta.tags ?? []).join(", ")); if (value !== null) setTags(selectedPath, value.split(",")); render(); } });
      action("Comment", () => { if (selectedPath) { const meta = metadataFor(selectedPath); const value = prompt("Comment", meta.comment ?? ""); if (value !== null) setComment(selectedPath, value); render(); } });
      action("Rename", () => {
        const node = selected();
        if (!node) return;
        const nextName = prompt("Rename", node.name);
        if (!nextName) return;
        const result = renameNode(node.path, nextName);
        selectedPath = typeof result === "string" && result.startsWith("/") ? result : "";
        if (result && !result.startsWith("/")) context.notify(result);
      });
      action("Duplicate", () => { const node = selected(); if (node) { const result = duplicateNode(node.path); if (result && !result.startsWith("/")) context.notify(result); } });
      action("Copy Path", async () => { if (selectedPath) { await navigator.clipboard?.writeText(selectedPath); context.notify("Path copied"); } });
      action("Move to Trash", () => { const node = selected(); if (node) context.notify(removeNode(node.path) ?? "Moved to Trash"); });
      if (path === "/Trash") action("Restore", () => { const node = selected(); if (node) context.notify(restoreNode(node.path) ?? "Restored"); });
      main.append(toolbar);

      if (!node) {
        main.append(el("p", "text-white/60", { text: "Folder not found." }));
        return;
      }

      if (node.type !== "folder" && node.type !== "trash") {
        const meta = metadataFor(node.path);
        const doc = el("article", "rounded-3xl border border-white/15 bg-white/10 p-5");
        append(doc, [icon(node.icon, "text-4xl text-cyan-200"), el("h2", "mt-3 text-2xl font-black", { text: node.name }), el("p", "mt-3 whitespace-pre-wrap text-white/70", { text: node.body || node.path }), el("p", "mt-4 font-mono text-xs text-white/40", { text: `${meta.favorite ? "starred - " : ""}${meta.tags?.length ? `tags: ${meta.tags.join(", ")} - ` : ""}${meta.comment ?? ""}` })]);
        main.append(doc);
        return;
      }

      const grid = el("div", "grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3");
      listChildren(path).forEach((child) => {
        const item = el("button", "grid min-h-28 content-start justify-items-center gap-2 rounded-3xl border border-transparent p-3 text-center transition hover:border-white/15 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40", { type: "button" });
        item.dataset.fsPath = child.path;
        item.draggable = !isSmallScreen();
        const meta = metadataFor(child.path);
        append(item, [icon(child.icon, "text-4xl text-cyan-100"), el("span", "break-words text-xs leading-4 text-white/75", { text: `${meta.favorite ? "* " : ""}${child.name}` }), el("span", "min-h-4 text-[0.65rem] text-cyan-100/45", { text: meta.tags?.slice(0, 2).join(" #") ?? "" })]);
        item.addEventListener("dblclick", () => context.openNode(child));
        bindButtonAction(item, () => {
          selectItem(item, child.path);
          if (child.type === "folder" || child.type === "trash") openPath(child.path);
          else if (isSmallScreen() || child.type === "app") context.openNode(child);
        });
        item.addEventListener("contextmenu", (event) => { event.preventDefault(); selectedPath = child.path; render(); });
        item.addEventListener("dragstart", (event) => event.dataTransfer?.setData("text/plain", child.path));
        if (child.type === "folder" || child.type === "trash") {
          item.addEventListener("dragover", (event) => event.preventDefault());
          item.addEventListener("drop", (event) => {
            event.preventDefault();
            const source = event.dataTransfer?.getData("text/plain");
            if (!source || source === child.path) return;
            const error = child.type === "trash" ? removeNode(source) : moveNode(source, child.path);
            context.notify(error ?? `Moved to ${child.name}`);
          });
        }
        if (selectedPath === child.path) item.classList.add("border-cyan-300/40", "bg-cyan-300/10");
        grid.append(item);
      });
      main.append(grid);
    }

    append(root, [sidebar, main]);
    window.addEventListener(FS_CHANGED_EVENT, render);
    render();
    return root;
  }
};
