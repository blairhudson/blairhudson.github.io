import { append, button, el, subtleButton } from "../../os/kernel/dom";
import { createNode, findNode, FS_CHANGED_EVENT, listChildren, writeDocument } from "../../os/kernel/filesystem";
import type { AppManifest } from "../../os/kernel/types";

const notesPath = "/Home/blair/Notes";

export const notesManifest: AppManifest = {
  id: "notes",
  name: "Notes",
  icon: "ph-notebook",
  defaultSize: { width: 780, height: 560 },
  render: (context) => {
    let current = listChildren(notesPath)[0]?.path;
    const root = el("section", "grid h-full grid-cols-[220px_1fr] text-white max-sm:grid-cols-1");
    const sidebar = el("aside", "grid grid-rows-[auto_1fr] gap-3 border-r border-white/10 p-4");
    const list = el("div", "grid content-start gap-2 overflow-auto");
    const editor = el("textarea", "h-full w-full resize-none border-0 bg-black/35 p-5 font-mono text-sm leading-6 text-white outline-none placeholder:text-white/35") as HTMLTextAreaElement;
    const title = el("input", "w-full border-0 border-b border-white/10 bg-transparent px-5 py-4 text-xl font-black text-white outline-none") as HTMLInputElement;

    const load = () => {
      const node = current ? findNode(current) : undefined;
      title.value = node?.name ?? "No note";
      editor.value = node?.body ?? "";
    };
    const renderList = () => {
      list.replaceChildren();
      listChildren(notesPath).filter((node) => node.type === "document").forEach((node) => {
        const row = el("button", `${subtleButton} ${node.path === current ? "border-cyan-200/40 bg-cyan-300/10" : ""}`, { type: "button", text: node.name });
        row.addEventListener("click", () => { current = node.path; load(); renderList(); });
        list.append(row);
      });
    };
    const save = () => {
      if (!current) return;
      const error = writeDocument(current, editor.value);
      context.notify(error ?? `${title.value} saved`);
    };
    const newNote = () => {
      const name = `note-${new Date().toISOString().slice(0, 10)}.md`;
      const path = `${notesPath}/${name}`;
      const error = createNode(path, "document", "# New note\n");
      if (error) context.notify(error);
      current = path;
      renderList();
      load();
    };

    append(sidebar, [button("rounded-2xl bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", "New Note", newNote), list]);
    append(root, [sidebar, append(el("main", "grid h-full grid-rows-[auto_1fr_auto]"), [title, editor, append(el("footer", "flex justify-end border-t border-white/10 p-3"), [button("rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-100", "Save", save)])])]);
    window.addEventListener(FS_CHANGED_EVENT, () => { renderList(); load(); });
    renderList();
    load();
    return root;
  }
};
