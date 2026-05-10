import { append, el } from "../../os/kernel/dom";
import { flattenFs, FS_CHANGED_EVENT } from "../../os/kernel/filesystem";
import { focusedProcessId, processes } from "../../os/kernel/processes";
import type { AppManifest } from "../../os/kernel/types";

export const systemProfilerManifest: AppManifest = {
  id: "systemProfiler",
  name: "System Profiler",
  icon: "ph-cpu",
  defaultSize: { width: 700, height: 520 },
  render: () => {
    const root = el("section", "grid h-full grid-rows-[auto_1fr] gap-4 p-5 text-white");
    append(root, [el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "System Profiler" })]);
    const cards = el("div", "grid content-start gap-3 overflow-auto sm:grid-cols-2");
    const render = () => {
      const nodes = flattenFs();
      const rows = processes.get();
      const focused = rows.find((process) => process.id === focusedProcessId.get());
      cards.replaceChildren();
      [
        ["Machine", "BlairOS Desktop"],
        ["Kernel", "BlairOS Darwin Kernel"],
        ["User", "blair"],
        ["Display", `${screen.width} x ${screen.height}`],
        ["Applications", String(nodes.filter((node) => node.type === "app").length)],
        ["Filesystem Nodes", String(nodes.length)],
        ["Documents", String(nodes.filter((node) => node.type === "document").length)],
        ["Links", String(nodes.filter((node) => node.type === "link").length)],
        ["Open Windows", String(rows.length)],
        ["Front Process", focused ? `${focused.title} (${focused.id})` : "Finder"],
        ["Visible Processes", String(rows.filter((process) => !process.minimized).length)],
        ["Agent", navigator.userAgent]
      ].forEach(([label, value]) => append(cards, [append(el("div", "rounded-3xl border border-white/10 bg-black/20 p-4"), [el("p", "text-xs uppercase tracking-widest text-white/40", { text: label }), el("p", "mt-2 break-words text-sm font-semibold text-white/80", { text: value })])]));
    };
    const unsubscribeProcesses = processes.subscribe(render);
    const unsubscribeFocus = focusedProcessId.subscribe(render);
    window.addEventListener(FS_CHANGED_EVENT, render);
    new MutationObserver((_, observer) => {
      if (document.body.contains(root)) return;
      unsubscribeProcesses();
      unsubscribeFocus();
      window.removeEventListener(FS_CHANGED_EVENT, render);
      observer.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
    render();
    append(root, [cards]);
    return root;
  }
};
