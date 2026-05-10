import { append, button, el } from "../../os/kernel/dom";
import { createNode, findNode, writeDocument } from "../../os/kernel/filesystem";
import { clearLogs, logs } from "../../os/kernel/logs";
import { processes } from "../../os/kernel/processes";
import type { AppManifest } from "../../os/kernel/types";

function history() {
  try {
    return JSON.parse(localStorage.getItem("blairos.history") ?? "[]") as string[];
  } catch {
    return [];
  }
}

export const consoleManifest: AppManifest = {
  id: "console",
  name: "Console",
  icon: "ph-list-magnifying-glass",
  defaultSize: { width: 760, height: 520 },
  render: () => {
    const root = el("section", "grid h-full grid-rows-[auto_auto_1fr] bg-black/35 p-5 font-mono text-sm text-white");
    const filter = el("input", "rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50", { type: "search", placeholder: "filter logs" });
    const actions = el("div", "mb-3 flex flex-wrap gap-2");
    append(root, [el("h2", "mb-4 font-sans text-3xl font-black tracking-[-0.07em]", { text: "Console" })]);
    const log = el("div", "overflow-auto rounded-3xl border border-white/10 bg-black/35 p-4 text-white/70");
    let lines: string[] = [];
    const render = () => {
      lines = [
        `boot: windowserver ready pid=${processes.get().length}`,
        ...processes.get().map((process) => `process: ${process.id} ${process.appId} ${process.title} ${process.minimized ? "minimized" : "active"} z=${process.z}`),
        ...logs.get().map((entry) => `${entry.time} ${entry.source}: ${entry.message}`),
        ...history().slice(-30).map((item) => `terminal: ${item}`)
      ];
      log.replaceChildren();
      const query = filter.value.toLowerCase();
      lines.filter((line) => line.toLowerCase().includes(query)).forEach((line) => log.append(el("p", "mb-1", { text: line })));
    };
    filter.addEventListener("input", render);
    append(actions, [
      button("rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20", "Clear Logs", () => { localStorage.setItem("blairos.history", "[]"); clearLogs(); render(); }),
      button("rounded-2xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200", "Save Log", () => {
        const path = "/Home/blair/Notes/console-log.txt";
        const error = findNode(path) ? writeDocument(path, lines.join("\n")) : createNode(path, "document", lines.join("\n"));
        log.prepend(el("p", error ? "mb-1 text-red-200" : "mb-1 text-cyan-200", { text: error ?? `saved: ${path}` }));
      })
    ]);
    const unsubscribe = processes.subscribe(render);
    const unsubscribeLogs = logs.subscribe(render);
    const timer = window.setInterval(render, 2000);
    new MutationObserver((_, observer) => {
      if (document.body.contains(root)) return;
      unsubscribe();
      unsubscribeLogs();
      window.clearInterval(timer);
      observer.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
    render();
    append(root, [append(el("div", "mb-3 grid gap-2 sm:grid-cols-[1fr_auto]"), [filter, actions]), log]);
    return root;
  }
};
