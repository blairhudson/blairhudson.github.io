import { append, button, el } from "../../os/kernel/dom";
import { links } from "../../os/data/links";
import type { AppManifest } from "../../os/kernel/types";

const repoLinks = links.filter((link) => link.href.includes("github.com") || link.tags.some((tag) => ["github", "code"].includes(tag)));

export const gitManifest: AppManifest = {
  id: "git",
  name: "Git",
  icon: "ph-git-branch",
  defaultSize: { width: 780, height: 540 },
  render: (context) => {
    const root = el("section", "grid h-full grid-rows-[auto_1fr] gap-4 p-5 text-white");
    append(root, [append(el("header", "flex items-center justify-between gap-3"), [append(el("div"), [el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "Git" }), el("p", "text-sm text-white/55", { text: "Repositories from your Links folder." })]), button("rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950", "Open Links", () => context.launchApp("files", { path: "/Home/blair/Links" }))])]);
    const list = el("div", "grid content-start gap-3 overflow-auto");
    repoLinks.forEach((repo) => append(list, [append(el("article", "grid gap-3 rounded-3xl border border-white/10 bg-black/25 p-4 sm:grid-cols-[1fr_auto] sm:items-center"), [append(el("div"), [el("p", "font-mono text-xs text-cyan-200", { text: repo.href.replace(/^https?:\/\//, "") }), el("h3", "mt-1 text-lg font-bold", { text: repo.label }), el("p", "mt-1 text-sm text-white/50", { text: repo.subtitle })]), button("rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20", "Open", () => context.launchApp("browser", { url: repo.href }))])]));
    if (!repoLinks.length) list.append(el("p", "rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-white/55", { text: "No Git links found in /Home/blair/Links." }));
    append(root, [list]);
    return root;
  }
};
