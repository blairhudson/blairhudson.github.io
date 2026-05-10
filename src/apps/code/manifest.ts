import { createNode, findNode, FS_CHANGED_EVENT, listChildren, writeDocument } from "../../os/kernel/filesystem";
import { append, button, el, icon, subtleButton } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

const DEFAULT_PATH = "/Home/blair/Code/hello.js";

function runJavaScript(source: string, onLine: (line: string) => void) {
  const workerSource = `
    const send = (type, value) => postMessage({ type, value: String(value) });
    console.log = (...args) => send("log", args.map(String).join(" "));
    console.error = (...args) => send("error", args.map(String).join(" "));
    console.warn = (...args) => send("warn", args.map(String).join(" "));
    self.onmessage = async (event) => {
      try {
        const result = await (async () => { ${source}\n })();
        if (result !== undefined) send("result", result);
        postMessage({ type: "done", value: "Process exited 0" });
      } catch (error) {
        send("error", error && error.stack ? error.stack : error);
        postMessage({ type: "done", value: "Process exited 1" });
      }
    };
  `;
  const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const worker = new Worker(url);
  const timeout = window.setTimeout(() => {
    worker.terminate();
    URL.revokeObjectURL(url);
    onLine("Process killed: timeout");
  }, 3000);
  worker.onmessage = (event: MessageEvent<{ type: string; value: string }>) => {
    const { type, value } = event.data;
    if (type === "done") {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
    }
    onLine(type === "log" ? value : `[${type}] ${value}`);
  };
  worker.onerror = (event) => {
    window.clearTimeout(timeout);
    worker.terminate();
    URL.revokeObjectURL(url);
    onLine(`[error] ${event.message}`);
    onLine("[done] Process exited 1");
  };
  worker.postMessage(null);
}

export const codeManifest: AppManifest = {
  id: "code",
  name: "Code",
  icon: "ph-code-block",
  defaultSize: { width: 960, height: 640 },
  render: (context) => {
    let path = String(context.process.data?.path || DEFAULT_PATH);
    let savedBody = "";
    const root = el("section", "grid h-full grid-cols-[220px_1fr] overflow-hidden bg-slate-950/30 text-white max-md:grid-cols-1");
    const sidebar = el("aside", "grid min-h-0 grid-rows-[auto_1fr] border-r border-white/10 bg-black/20 max-md:hidden");
    const fileList = el("div", "grid content-start gap-2 overflow-auto p-3");
    const main = el("main", "grid min-h-0 grid-rows-[auto_1fr_170px]");
    const title = el("div", "min-w-0");
    const status = el("span", "font-mono text-xs text-white/45");
    const editor = el("textarea", "min-h-0 resize-none bg-slate-950 px-5 py-4 font-mono text-sm leading-6 text-cyan-50 outline-none placeholder:text-white/30 [tab-size:2]", { spellcheck: false }) as HTMLTextAreaElement;
    const output = el("pre", "m-0 overflow-auto border-t border-white/10 bg-black/55 p-4 font-mono text-xs leading-5 text-emerald-100 whitespace-pre-wrap", { text: "Run output appears here." });
    const saveButton = button(`${subtleButton} flex items-center gap-2`, "Save", save);

    function load(nextPath = path) {
      path = nextPath;
      const node = findNode(path);
      title.replaceChildren();
      if (!node || node.type !== "document") {
        editor.value = `${path}: no file`;
        editor.disabled = true;
        savedBody = editor.value;
        append(title, [icon("ph-warning", "text-xl text-amber-200"), el("span", "ml-2 font-bold", { text: "Cannot edit file" })]);
        updateDirty();
        return;
      }
      editor.disabled = false;
      savedBody = node.body ?? "";
      editor.value = savedBody;
      append(title, [el("h2", "truncate text-sm font-bold", { text: node.name }), status]);
      updateDirty();
      renderFiles();
    }

    function save() {
      const error = findNode(path) ? writeDocument(path, editor.value) : createNode(path, "document", editor.value);
      if (error) context.notify(`Code: ${error}`);
      else {
        savedBody = editor.value;
        updateDirty();
        context.notify(`Saved ${path}`);
        renderFiles();
      }
    }

    function updateDirty() {
      status.textContent = `${path}${editor.value !== savedBody ? " - edited" : ""}`;
    }

    function run() {
      save();
      output.textContent = `> node ${path}\n`;
      runJavaScript(editor.value, (line) => {
        output.textContent += `${line}\n`;
        output.scrollTop = output.scrollHeight;
      });
    }

    function renderFiles() {
      fileList.replaceChildren();
      const nodes = listChildren("/Home/blair/Code").filter((node) => node.type === "document");
      nodes.forEach((node) => {
        const row = button(`${subtleButton} text-left ${node.path === path ? "border-cyan-300/50 bg-cyan-300/10" : ""}`, node.name, () => load(node.path));
        fileList.append(row);
      });
      if (!nodes.length) fileList.append(el("p", "p-3 text-sm text-white/50", { text: "No code files." }));
    }

    const header = append(el("header", "flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3"), [
      title,
      append(el("div", "flex items-center gap-2"), [
        button(subtleButton, "New JS", () => {
          const name = prompt("File name", "scratch.js") || "scratch.js";
          const next = `/Home/blair/Code/${name.endsWith(".js") ? name : `${name}.js`}`;
          const error = createNode(next, "document", "console.log('hello from Code');\n");
          if (error) context.notify(`Code: ${error}`);
          load(next);
        }),
        saveButton,
        button("rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", "Run JS", run)
      ])
    ]);
    append(sidebar, [append(el("div", "border-b border-white/10 p-4"), [el("h2", "text-2xl font-black tracking-[-0.07em]", { text: "Code" }), el("p", "text-sm text-white/50", { text: "/Home/blair/Code" })]), fileList]);
    append(main, [header, editor, output]);
    append(root, [sidebar, main]);
    editor.addEventListener("input", updateDirty);
    editor.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = `${editor.value.slice(0, start)}  ${editor.value.slice(end)}`;
      editor.selectionStart = editor.selectionEnd = start + 2;
      updateDirty();
    });
    window.addEventListener(FS_CHANGED_EVENT, () => {
      if (editor.value === savedBody) load(path);
      else renderFiles();
    });
    load(path);
    queueMicrotask(() => editor.focus());
    return root;
  }
};
