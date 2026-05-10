import { append, button, el } from "../../os/kernel/dom";
import { listChildren } from "../../os/kernel/filesystem";
import { installedPackages, PACKAGES_CHANGED_EVENT } from "../../os/kernel/packages";
import type { AppId, AppManifest } from "../../os/kernel/types";
import { programs } from "../../programs/bin";

export const packageManagerManifest: AppManifest = {
  id: "packageManager",
  name: "Package Manager",
  icon: "ph-package",
  defaultSize: { width: 680, height: 500 },
  render: (context) => {
    const root = el("section", "grid h-full grid-rows-[auto_auto_1fr] gap-4 p-5 text-white");
    const grid = el("div", "grid content-start gap-3 overflow-auto sm:grid-cols-2");
    const title = el("div");
    function renderPackages() {
      const apps = listChildren("/Applications").filter((node) => node.type === "app" && node.appId);
      const installed = installedPackages();
      title.replaceChildren(
        el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "Package Manager" }),
        el("p", "text-sm text-white/60", { text: `${apps.length} apps, ${programs.length} command-line tools, ${installed.length} user packages installed.` })
      );
      grid.replaceChildren();
      installed.toSorted((a, b) => a.name.localeCompare(b.name)).forEach((pkg) => append(grid, [append(el("article", "rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4"), [el("p", "text-xs uppercase tracking-widest text-emerald-100/60", { text: pkg.manager }), el("h3", "mt-1 text-lg font-bold", { text: pkg.name }), el("p", "mt-1 font-mono text-xs text-white/40", { text: `installed ${new Date(pkg.installedAt).toLocaleString()}` })])]));
      apps.toSorted((a, b) => a.name.localeCompare(b.name)).forEach((app) => append(grid, [append(el("article", "rounded-3xl border border-white/10 bg-black/25 p-4"), [el("p", "text-xs uppercase tracking-widest text-cyan-100/50", { text: "Application" }), el("h3", "mt-1 text-lg font-bold", { text: app.name }), el("p", "mt-1 font-mono text-xs text-white/40", { text: app.path }), button("mt-4 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", "Open", () => context.launchApp(app.appId as AppId))])]));
      programs.toSorted((a, b) => a.name.localeCompare(b.name)).forEach((program) => append(grid, [append(el("article", "rounded-3xl border border-white/10 bg-black/25 p-4"), [el("p", "text-xs uppercase tracking-widest text-amber-100/50", { text: "Command" }), el("h3", "mt-1 text-lg font-bold", { text: program.name }), el("p", "mt-1 line-clamp-2 text-sm text-white/45", { text: program.help }), button("mt-4 rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20", "Show Path", () => context.notify(`/bin/${program.name}`))])]));
    }
    append(root, [title, grid]);
    renderPackages();
    window.addEventListener(PACKAGES_CHANGED_EVENT, renderPackages);
    return root;
  }
};
