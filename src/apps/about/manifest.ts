import { append, el } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

export const aboutManifest: AppManifest = {
  id: "about",
  name: "About BlairOS",
  icon: "ph-info",
  defaultSize: { width: 620, height: 520 },
  render: () => {
    const root = el("section", "grid gap-5 p-6 text-white");
    const hero = el("div", "rounded-[28px] border border-white/15 bg-white/10 p-6");
    append(hero, [
      el("div", "font-mono text-xs uppercase tracking-[0.35em] text-cyan-200", { text: "BlairOS v2" }),
      el("h1", "mt-3 text-4xl font-black tracking-[-0.08em]", { text: "Desktop shell, real signal." }),
      el("p", "mt-3 max-w-xl text-sm leading-6 text-white/70", {
        text: "BlairOS turns blairhudson.com into a portfolio OS: apps, files, commands, projects, writing, and research."
      })
    ]);

    const specs = el("div", "grid gap-3 sm:grid-cols-2");
    [
      ["Kernel", "Astro + TypeScript + local filesystem"],
      ["Runtime", "BlairOS WindowServer"],
      ["Shell", "Windows, dock, launcher, desktop icons"],
      ["User", "Blair Hudson // AI + software engineering"]
    ].forEach(([label, value]) => {
      const card = el("div", "rounded-3xl border border-white/10 bg-black/20 p-4");
      append(card, [el("div", "text-xs uppercase tracking-widest text-white/40", { text: label }), el("div", "mt-2 font-semibold text-white/85", { text: value })]);
      specs.append(card);
    });

    append(root, [hero, specs, el("p", "font-mono text-xs text-white/45", { text: "tip: press ctrl/cmd+k for launcher, ctrl/cmd+space for terminal" })]);
    return root;
  }
};
