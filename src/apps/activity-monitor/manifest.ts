import { append, button, el, icon } from "../../os/kernel/dom";
import { jobs } from "../../os/kernel/jobs";
import { closeProcess, focusedProcessId, processes } from "../../os/kernel/processes";
import type { AppManifest } from "../../os/kernel/types";

function loadFor(processId: string, index: number) {
  const seed = [...processId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return 2 + ((seed + index * 11 + Math.floor(Date.now() / 1800)) % 18);
}

function memoryFor(width: number, height: number, index: number) {
  return Math.max(18, Math.round((width * height) / 18000) + index * 3);
}

export const activityMonitorManifest: AppManifest = {
  id: "activityMonitor",
  name: "Activity Monitor",
  icon: "ph-pulse",
  defaultSize: { width: 760, height: 520 },
  render: () => {
    const root = el("section", "grid h-full grid-rows-[auto_1fr] gap-4 p-5 text-white");
    const header = el("div", "grid gap-3 rounded-[28px] border border-white/15 bg-white/10 p-5 sm:grid-cols-4");
    const list = el("div", "overflow-auto rounded-[24px] border border-white/10 bg-black/20");

    const render = () => {
      const rows = processes.get();
      const jobRows = jobs.get();
      const focused = focusedProcessId.get();
      const cpu = rows.reduce((total, process, index) => total + (process.id === focused ? loadFor(process.id, index) + 12 : process.minimized ? 1 : loadFor(process.id, index)), 0);
      const memory = rows.reduce((total, process, index) => total + memoryFor(process.width, process.height, index), 0);
      header.replaceChildren();
      [["Processes", rows.length], ["Jobs", jobRows.filter((job) => job.state === "running").length], ["CPU", `${cpu}%`], ["Memory", `${memory}M`]].forEach(([label, value]) => {
        append(header, [append(el("div", "rounded-2xl bg-black/20 p-4"), [el("p", "text-xs uppercase tracking-widest text-white/40", { text: String(label) }), el("p", "mt-2 text-2xl font-black", { text: String(value) })])]);
      });
      list.replaceChildren();
      append(list, [
        append(el("div", "grid grid-cols-[86px_minmax(150px,1fr)_86px_64px_70px_118px_72px] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-widest text-white/40"), [
          ...["PID", "Name", "State", "CPU", "Mem", "Window", "Action"].map((label) => el("span", "truncate", { text: label }))
        ])
      ]);
      rows.toSorted((a, b) => b.z - a.z).forEach((process, index) => {
        const state = process.minimized ? "sleep" : process.id === focused ? "front" : process.maximized ? "max" : "run";
        const cpuValue = process.id === focused ? loadFor(process.id, index) + 12 : process.minimized ? 1 : loadFor(process.id, index);
        const memoryValue = memoryFor(process.width, process.height, index);
        const row = el("div", "grid grid-cols-[86px_minmax(150px,1fr)_86px_64px_70px_118px_72px] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm text-white/75");
        const quit = button("rounded-xl bg-red-400/90 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-red-300", "Quit", () => {
          closeProcess(process.id);
          render();
        });
        quit.addEventListener("pointerdown", (event) => event.stopPropagation());
        quit.addEventListener("click", (event) => event.stopPropagation());
        append(row, [
          el("span", "font-mono text-xs", { text: process.id }),
          append(el("span", "truncate font-semibold"), [icon(process.icon, "mr-2 inline text-lg text-cyan-200"), process.title]),
          el("span", `rounded-full px-2 py-1 text-center font-mono text-[0.68rem] ${state === "front" ? "bg-cyan-300/20 text-cyan-100" : "bg-white/10 text-white/55"}`, { text: state }),
          el("span", "font-mono text-xs", { text: `${cpuValue}%` }),
          el("span", "font-mono text-xs", { text: `${memoryValue}M` }),
          el("span", "font-mono text-xs text-white/50", { text: `${Math.round(process.x)},${Math.round(process.y)} ${Math.round(process.width)}x${Math.round(process.height)}` }),
          quit
        ]);
        list.append(row);
      });
      jobRows.forEach((job) => {
        const row = el("div", "grid grid-cols-[86px_minmax(150px,1fr)_86px_64px_70px_118px_72px] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm text-white/75");
        append(row, [
          el("span", "font-mono text-xs", { text: job.id.slice(0, 8) }),
          append(el("span", "truncate font-semibold"), [icon("ph-spinner-gap", "mr-2 inline text-lg text-cyan-200"), job.name]),
          el("span", "rounded-full bg-cyan-300/15 px-2 py-1 text-center font-mono text-[0.68rem] text-cyan-100", { text: job.state }),
          el("span", "font-mono text-xs", { text: `${Math.max(1, Math.round(job.progress / 9))}%` }),
          el("span", "font-mono text-xs", { text: "12M" }),
          el("span", "font-mono text-xs text-white/50", { text: job.app }),
          el("span", "text-xs text-white/35", { text: `${job.progress}%` })
        ]);
        list.append(row);
      });
    };

    const unsubscribeProcesses = processes.subscribe(render);
    const unsubscribeFocus = focusedProcessId.subscribe(render);
    const unsubscribeJobs = jobs.subscribe(render);
    const timer = window.setInterval(render, 1800);
    new MutationObserver((_, observer) => {
      if (document.body.contains(root)) return;
      window.clearInterval(timer);
      unsubscribeProcesses();
      unsubscribeFocus();
      unsubscribeJobs();
      observer.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
    render();
    append(root, [header, list]);
    return root;
  }
};
