import { append, el, icon } from "../../os/kernel/dom";
import { findNode } from "../../os/kernel/filesystem";
import type { AppManifest } from "../../os/kernel/types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char] ?? char);
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code class="rounded-md bg-black/35 px-1.5 py-0.5 font-mono text-cyan-100">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black text-white">$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a class="text-cyan-200 underline decoration-cyan-200/40 underline-offset-4" href="$2">$1</a>');
}

function renderMarkdown(markdown: string) {
  const html: string[] = [];
  let inCode = false;
  let inList = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      if (inCode) html.push("</code></pre>");
      else html.push('<pre class="my-4 overflow-auto rounded-2xl border border-white/10 bg-black/45 p-4 text-sm"><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }
    const list = line.match(/^[-*]\s+(.+)/);
    if (list) {
      if (!inList) html.push('<ul class="my-4 grid gap-2 pl-5 text-white/75">');
      inList = true;
      html.push(`<li class="list-disc">${renderInline(list[1])}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const level = heading[1].length;
      const classes = level === 1 ? "mt-2 text-3xl font-black tracking-[-0.06em]" : level === 2 ? "mt-6 text-2xl font-black" : "mt-5 text-lg font-bold text-cyan-100";
      html.push(`<h${level} class="${classes}">${renderInline(heading[2])}</h${level}>`);
    } else {
      html.push(`<p class="my-3 leading-7 text-white/75">${renderInline(line)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  if (inCode) html.push("</code></pre>");
  return html.join("");
}

export const previewManifest: AppManifest = {
  id: "preview",
  name: "Preview",
  icon: "ph-eye",
  defaultSize: { width: 760, height: 560 },
  render: (context) => {
    const path = String(context.process.data?.path ?? "/Desktop/README.txt");
    const node = findNode(path);
    const root = el("section", "grid h-full grid-rows-[auto_1fr] text-white");
    const codeMode = el("button", "rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20", { type: "button", text: "Code Mode" });
    codeMode.addEventListener("click", () => context.launchApp("editor", { path }));
    append(root, [append(el("header", "flex items-center justify-between gap-3 border-b border-white/10 p-4"), [append(el("div", "flex min-w-0 items-center gap-3"), [icon(node?.icon ?? "ph-file", "text-3xl text-cyan-200"), append(el("div", "min-w-0"), [el("h2", "truncate text-lg font-bold", { text: node?.name ?? "No Selection" }), el("p", "truncate font-mono text-xs text-white/45", { text: node?.path ?? path })])]), codeMode])]);
    const body = el("div", "overflow-auto p-5");
    if (node?.href) body.append(el("iframe", "h-full min-h-[360px] w-full rounded-2xl border border-white/10 bg-white", { src: node.href, title: node.name }));
    else if (node?.name.endsWith(".md")) body.append(el("article", "mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/30 p-6", { html: renderMarkdown(node.body ?? "") }));
    else body.append(el("pre", "whitespace-pre-wrap rounded-3xl border border-white/10 bg-black/35 p-5 text-sm leading-6 text-white/75", { text: node?.body ?? `${path}: no preview available` }));
    append(root, [body]);
    return root;
  }
};
