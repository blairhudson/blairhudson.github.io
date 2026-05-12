import { findNode, FS_CHANGED_EVENT, writeDocument } from "../../os/kernel/filesystem";
import { append, bindButtonAction, el, icon, subtleButton } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

export const editorManifest: AppManifest = {
  id: "editor",
  name: "Text Editor",
  icon: "ph-note-pencil",
  defaultSize: { width: 760, height: 560 },
  render: (context) => {
    const path = String(context.process.data?.path || "/Desktop/README.txt");
    let savedBody = "";
    const root = el("section", "flex h-full flex-col bg-slate-950/25 text-white");
    const header = el("div", "flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3");
    const title = el("div", "min-w-0");
    const status = el("span", "font-mono text-xs text-white/45", { text: path });
    const textarea = el("textarea", "min-h-0 flex-1 resize-none bg-slate-950 px-5 py-4 font-mono text-sm leading-6 text-cyan-50 outline-none placeholder:text-white/30", { spellcheck: true }) as HTMLTextAreaElement;
    const save = el("button", `${subtleButton} flex items-center gap-2`, { type: "button" });
    const revert = el("button", subtleButton, { type: "button", text: "Revert" });

    function load() {
      const node = findNode(path);
      title.replaceChildren();
      if (!node || node.type !== "document") {
        append(title, [icon("ph-warning", "text-xl text-amber-200"), el("span", "ml-2 font-bold", { text: "Cannot edit file" })]);
        textarea.value = `${path}: not a text file`;
        textarea.disabled = true;
        save.toggleAttribute("disabled", true);
        return;
      }
      savedBody = node.body || "";
      textarea.value = savedBody;
      append(title, [el("h2", "truncate text-sm font-bold", { text: node.name }), status]);
      save.toggleAttribute("disabled", false);
      updateDirty();
    }

    function updateDirty() {
      const dirty = textarea.value !== savedBody;
      status.textContent = `${path}${dirty ? " - edited" : ""}`;
    }

    bindButtonAction(save, () => {
      const error = writeDocument(path, textarea.value);
      if (error) context.notify(`Text Editor: ${error}`);
      else {
        savedBody = textarea.value;
        updateDirty();
        context.notify(`Saved ${path}`);
      }
    });
    bindButtonAction(revert, load);
    textarea.addEventListener("input", updateDirty);
    window.addEventListener(FS_CHANGED_EVENT, () => {
      if (textarea.value === savedBody) load();
    });

    append(save, [icon("ph-floppy-disk", "text-lg"), "Save"]);
    append(header, [title, append(el("div", "flex items-center gap-2"), [revert, save])]);
    append(root, [header, textarea]);
    load();
    queueMicrotask(() => textarea.focus());
    return root;
  }
};
