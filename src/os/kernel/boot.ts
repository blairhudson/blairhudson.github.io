import Fuse from "fuse.js";
import { toCanvas } from "html-to-image";
import interact from "interactjs";
import { appManifests, appRegistry } from "./apps";
import { append, el, glass, icon } from "./dom";
import { copyNode, createNode, desktopNodes, findNode, moveNode, removeNode, searchableNodes, writeDocument } from "./filesystem";
import { jobs, startJob, finishJob, failJob, updateJob } from "./jobs";
import { logEvent } from "./logs";
import { metadataFor, setComment, setTags, toggleFavorite, touchOpened } from "./metadata";
import { addNotification, clearNotifications, notifications } from "./notifications";
import { addRecentItem, clearRecentItems, getRecentItems } from "./recent";
import { bindSettings, settings } from "./settings";
import {
  closeProcess,
  focusProcess,
  focusedProcessId,
  launchApp,
  minimizeProcess,
  processes,
  restoreSession,
  restoreProcess,
  toggleMaximizeProcess,
  updateProcess
} from "./processes";
import type { AppId, AppContext, ProcessRecord } from "./types";
import type { FsNode } from "../data/filesystem";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  kind: "app" | "file" | "program" | "link" | "action";
  action: () => void;
};

type MenuItem = {
  label: string;
  shortcut?: string;
  action: () => void;
};

const root = document.getElementById("os-root")!;
if (!root) throw new Error("missing #os-root");

let windowLayer: HTMLElement;
let dock: HTMLElement;
let activeApp: HTMLElement;
let launcher: HTMLElement;
let launcherResults: HTMLElement;
let launcherInput: HTMLInputElement;
let contextMenu: HTMLElement | null = null;
let notificationPanel: HTMLElement | null = null;
let toastTimer: number | undefined;
let clipboardPath = "";
let screensaver: HTMLElement | null = null;
let idleTimer: number | undefined;
const dockAppIds: AppId[] = ["files", "browser", "terminal", "code", "sheets", "notes", "preview", "activityMonitor", "settings", "trash"];

function notify(message: string) {
  addNotification(message);
  logEvent("notification", message);
  const existing = document.querySelector("[data-toast]");
  existing?.remove();
  const toast = el("div", "fixed bottom-[calc(var(--dock-height)+16px)] right-4 z-[9500] max-w-[min(420px,calc(100vw-28px))] rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-3 text-sm text-white/70 shadow-2xl backdrop-blur-2xl", { text: message });
  toast.dataset.toast = "true";
  document.body.append(toast);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.remove(), 2600);
}

function runJob(name: string, app: string, detail: string, done: () => void | Promise<void>) {
  const id = startJob(name, app, detail);
  logEvent(app, `started ${name}`);
  let progress = 8;
  const timer = window.setInterval(() => {
    progress = Math.min(92, progress + 14 + Math.round(Math.random() * 13));
    updateJob(id, { progress });
  }, 180);
  window.setTimeout(async () => {
    window.clearInterval(timer);
    try {
      await done();
      finishJob(id, "complete");
      logEvent(app, `finished ${name}`);
      notify(`${name} complete`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      failJob(id, message);
      logEvent(app, `failed ${name}: ${message}`);
      notify(`${name} failed`);
    }
  }, 820);
}

function openWith(node: FsNode, appId: AppId) {
  touchOpened(node.path);
  logEvent("open-with", `${node.path} -> ${appId}`);
  if (appId === "browser") contextOpenUrl(node);
  else contextLaunch(appId, { path: node.path });
}

function contextLaunch(appId: AppId, data?: Record<string, unknown>) {
  launchApp(appId, data);
}

function contextOpenUrl(node: FsNode) {
  launchApp("browser", { url: node.href || node.path });
}

async function drawAccessibleIframeContents(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rootRect = root.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, rootRect.width);
  const scaleY = canvas.height / Math.max(1, rootRect.height);
  const frames = [...root.querySelectorAll("iframe")] as HTMLIFrameElement[];

  for (const frame of frames) {
    try {
      const doc = frame.contentDocument;
      const target = doc?.documentElement || doc?.body;
      if (!target) continue;

      const rect = frame.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const frameCanvas = await toCanvas(target, {
        cacheBust: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height,
        style: { transform: "none" }
      });

      ctx.drawImage(
        frameCanvas,
        0,
        0,
        frameCanvas.width,
        frameCanvas.height,
        (rect.left - rootRect.left) * scaleX,
        (rect.top - rootRect.top) * scaleY,
        rect.width * scaleX,
        rect.height * scaleY
      );
    } catch {
      // Cross-origin frames intentionally block pixel access; leave captured shell as-is.
    }
  }
}

async function currentRenderingScreenshotDataUrl() {
  const canvas = await toCanvas(root, {
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    width: root.clientWidth || window.innerWidth,
    height: root.clientHeight || window.innerHeight,
    style: {
      transform: "none"
    }
  });
  await drawAccessibleIframeContents(canvas);
  return canvas.toDataURL("image/png");
}

function takeScreenshot() {
  runJob("Screenshot", "windowserver", "capturing desktop", async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const path = `/Desktop/Screenshot ${stamp}.png`;
    const body = await currentRenderingScreenshotDataUrl();
    if (!body) throw new Error("empty capture");
    const error = findNode(path) ? writeDocument(path, body) : createNode(path, "document", body);
    if (error) throw new Error(error);
    notify(`Saved ${path}`);
    launchApp("preview", { path });
  });
}

function showLockScreen() {
  const overlay = el("div", "fixed inset-0 z-[9900] grid place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(125,211,252,.18),transparent_30%),linear-gradient(180deg,rgba(2,6,23,.95),rgba(15,23,42,.98))] p-6 text-white backdrop-blur-xl");
  const clock = el("p", "font-mono text-6xl font-black tracking-[-0.08em]");
  const tick = () => (clock.textContent = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: !settings.get().clock24h }).format(new Date()));
  const card = append(el("div", "grid justify-items-center gap-5 text-center"), [clock, el("p", "text-white/60", { text: "blair locked this session" }), el("button", "rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200", { type: "button", text: "Wake" })]);
  const timer = window.setInterval(tick, 15000);
  tick();
  (card.lastElementChild as HTMLButtonElement).addEventListener("click", () => { window.clearInterval(timer); overlay.remove(); notify("Session unlocked"); });
  append(overlay, [card]);
  root.append(overlay);
  notify("Display locked");
}

function stopScreensaver() {
  if (!screensaver) return;
  screensaver.remove();
  screensaver = null;
  notify("Display awake");
  resetIdleTimer();
}

function startScreensaver(auto = false) {
  if (screensaver) return;
  const overlay = el("div", "fixed inset-0 z-[9890] overflow-hidden bg-slate-950 text-white");
  const field = el("div", "absolute inset-0 opacity-80");
  field.style.background = "radial-gradient(circle at 20% 30%, rgba(34,211,238,.32), transparent 12rem), radial-gradient(circle at 80% 70%, rgba(168,85,247,.28), transparent 14rem), linear-gradient(135deg, #020617, #0f172a 48%, #111827)";
  const orb = el("div", "absolute h-40 w-40 rounded-full border border-cyan-200/40 bg-cyan-200/10 blur-[1px]");
  append(overlay, [field, orb]);
  root.append(overlay);
  screensaver = overlay;
  logEvent("windowserver", auto ? "idle screensaver started" : "screensaver started");
  if (!auto) notify("Screensaver started");
  let t = 0;
  const animate = window.setInterval(() => {
    if (!screensaver) {
      window.clearInterval(animate);
      return;
    }
    t += 0.018;
    const x = 50 + Math.sin(t * 1.7) * 36;
    const y = 45 + Math.cos(t * 1.2) * 30;
    orb.style.transform = `translate(calc(${x}vw - 5rem), calc(${y}vh - 5rem)) scale(${1 + Math.sin(t * 2) * 0.18})`;
    field.style.filter = `hue-rotate(${Math.round(Math.sin(t) * 28)}deg)`;
  }, 32);
  const wake = () => {
    window.clearInterval(animate);
    stopScreensaver();
  };
  overlay.addEventListener("mousemove", wake, { once: true });
  overlay.addEventListener("pointerdown", wake, { once: true });
  overlay.addEventListener("keydown", wake, { once: true });
  overlay.tabIndex = 0;
  overlay.focus({ preventScroll: true });
}

function resetIdleTimer() {
  if (screensaver) return;
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => startScreensaver(true), 60_000);
}

function bindIdleScreensaver() {
  ["mousemove", "mousedown", "keydown", "touchstart", "wheel"].forEach((eventName) => {
    window.addEventListener(eventName, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

function showNotificationCenter(anchor?: HTMLElement) {
  notificationPanel?.remove();
  const items = notifications.get();
  const activeJobs = jobs.get();
  notificationPanel = el("aside", "fixed right-3 top-[calc(var(--menu-height)+8px)] z-[9400] grid max-h-[min(680px,calc(100vh-90px))] w-[min(390px,calc(100vw-24px))] grid-rows-[auto_1fr_auto] gap-3 overflow-hidden rounded-[30px] border border-white/15 bg-slate-950/90 p-4 text-white shadow-2xl shadow-black/45 backdrop-blur-2xl");
  append(notificationPanel, [el("h2", "text-2xl font-black tracking-[-0.07em]", { text: "Notification Center" })]);
  const list = el("div", "grid gap-2 overflow-auto pr-1");
  activeJobs.forEach((job) => {
    const progress = el("span", "block h-full rounded-full bg-cyan-300");
    progress.style.width = `${job.progress}%`;
    list.append(append(el("article", "rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3"), [
      el("p", "font-bold", { text: job.name }),
      el("p", "text-xs text-white/45", { text: `${job.app} - ${job.state} - ${job.detail ?? ""}` }),
      append(el("div", "mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"), [progress])
    ]));
  });
  items.forEach((item) => list.append(append(el("article", "rounded-2xl border border-white/10 bg-white/8 p-3"), [
    el("p", "text-sm text-white/80", { text: item.message }),
    el("p", "mt-1 font-mono text-[0.68rem] text-white/35", { text: item.time })
  ])));
  if (!activeJobs.length && !items.length) list.append(el("p", "rounded-2xl border border-white/10 bg-white/8 p-4 text-white/50", { text: "No notifications" }));
  const footer = el("div", "flex gap-2");
  append(footer, [el("button", "rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20", { type: "button", text: "Clear" }), el("button", "rounded-2xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200", { type: "button", text: "Open Console" })]);
  (footer.firstElementChild as HTMLButtonElement).addEventListener("click", () => { clearNotifications(); notificationPanel?.remove(); notificationPanel = null; });
  (footer.lastElementChild as HTMLButtonElement).addEventListener("click", () => { launchApp("console"); notificationPanel?.remove(); notificationPanel = null; });
  append(notificationPanel, [list, footer]);
  root.append(notificationPanel);
  if (anchor) {
    const rect = notificationPanel.getBoundingClientRect();
    notificationPanel.style.right = `${Math.max(8, window.innerWidth - anchor.getBoundingClientRect().right)}px`;
    notificationPanel.style.maxHeight = `${Math.min(rect.height || 680, window.innerHeight - 56)}px`;
  }
}

function showEasterOverlay(title: string, detail: string) {
  const overlay = el("div", "fixed inset-0 z-[9800] grid place-items-center bg-black/60 p-6 text-white backdrop-blur-sm");
  const card = append(el("div", "max-w-xl rounded-[36px] border border-cyan-300/30 bg-slate-950/90 p-8 text-center shadow-2xl shadow-cyan-950/50"), [
    el("p", "font-mono text-xs uppercase tracking-[0.45em] text-cyan-200", { text: "hidden channel" }),
    el("h2", "mt-3 text-5xl font-black tracking-[-0.08em]", { text: title }),
    el("p", "mt-4 text-white/65", { text: detail }),
    el("button", "mt-6 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", { type: "button", text: "Continue" })
  ]);
  (card.lastElementChild as HTMLButtonElement).addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  append(overlay, [card]);
  root.append(overlay);
  window.setTimeout(() => overlay.remove(), 5200);
}

function unlockDebugStickers() {
  const stickers = ["PID 4242", "SHIP MODE", "ROOTISH", "NO VIBES IN PROD", "AGENT INSIDE"];
  const wrap = el("div", "pointer-events-none fixed inset-0 z-[7600]");
  stickers.forEach((text, index) => {
    const sticker = el("div", "absolute rotate-[-8deg] rounded-2xl border border-amber-200/40 bg-amber-200/90 px-4 py-2 font-mono text-xs font-black text-slate-950 shadow-xl", { text });
    sticker.style.left = `${12 + index * 15}%`;
    sticker.style.top = `${18 + (index % 3) * 18}%`;
    wrap.append(sticker);
  });
  root.append(wrap);
  notify("Debug stickers unlocked");
  window.setTimeout(() => wrap.remove(), 8000);
}

function openExternal(href: string) {
  addRecentItem({ id: `url:${href}`, title: href.replace(/^https?:\/\//, ""), subtitle: href, icon: "ph-globe", kind: "url", url: href });
  logEvent("browser", `open ${href}`);
  launchApp("browser", { url: href });
  notify(`Opened ${href} in Browser`);
}

function openNode(node: FsNode) {
  addRecentItem({ id: `fs:${node.path}`, title: node.name, subtitle: node.path, icon: node.icon, kind: node.href ? "url" : "file", path: node.path, url: node.href });
  touchOpened(node.path);
  logEvent("open", node.path);
  if (node.appId) launchApp(node.appId as AppId);
  else if (node.href) launchApp("browser", { url: node.href });
  else if (node.type === "folder" || node.type === "trash") launchApp("files", { path: node.path });
  else if (node.type === "document" && /\.(sheet|csv)$/i.test(node.name)) launchApp("sheets", { path: node.path });
  else if (node.type === "document" && /\.(js|mjs|cjs|ts|tsx|jsx|json|css)$/i.test(node.name)) launchApp("code", { path: node.path });
  else if (node.type === "document" && /\.(html?|png|jpe?g|gif|webp|svg|pdf|md)$/i.test(node.name)) launchApp("preview", { path: node.path });
  else if (node.type === "document") launchApp("editor", { path: node.path });
  else launchApp("files", { path: node.path });
}

function runRecent(item: ReturnType<typeof getRecentItems>[number]) {
  if (item.appId) launchApp(item.appId);
  else if (item.path) {
    const node = findNode(item.path);
    if (node) openNode(node);
    else notify(`${item.title} missing`);
  } else if (item.url) launchApp("browser", { url: item.url });
  else if (item.command) launchApp("terminal", { command: item.command });
}

function bindFsDrag(element: HTMLElement, node: FsNode) {
  element.draggable = true;
  element.addEventListener("dragstart", (event) => event.dataTransfer?.setData("text/plain", node.path));
  if (node.type !== "folder" && node.type !== "trash") return;
  element.addEventListener("dragover", (event) => event.preventDefault());
  element.addEventListener("drop", (event) => {
    event.preventDefault();
    const source = event.dataTransfer?.getData("text/plain");
    if (!source || source === node.path) return;
    const error = node.path === "/Trash" ? removeNode(source) : moveNode(source, node.path);
    notify(typeof error === "string" ? error : `Moved to ${node.name}`);
  });
}

function focusedProcess() {
  const id = focusedProcessId.get();
  return id ? processes.get().find((process) => process.id === id) : undefined;
}

function openWithItems(node: FsNode): MenuItem[] {
  if (node.type === "folder" || node.type === "trash") return [
    { label: "Open in Files", action: () => launchApp("files", { path: node.path }) }
  ];
  return [
    { label: "Open With Preview", action: () => openWith(node, "preview") },
    { label: "Open With Sheets", action: () => openWith(node, "sheets") },
    { label: "Open With Text Editor", action: () => openWith(node, "editor") },
    { label: "Open With Code", action: () => openWith(node, "code") },
    { label: "Open With Browser", action: () => openWith(node, "browser") },
    { label: "Attach in Mail", action: () => launchApp("mail", { attachment: node.path }) }
  ];
}

function pasteInto(path: string) {
  if (!clipboardPath) return notify("Clipboard empty");
  const error = copyNode(clipboardPath, path);
  notify(error ?? `Pasted ${clipboardPath}`);
}

function snapProcess(process: ProcessRecord, side: "left" | "right" | "top") {
  const rect = windowLayer.getBoundingClientRect();
  if (side === "top") updateProcess(process.id, { x: 8, y: 8, width: rect.width - 16, height: rect.height - 16, maximized: false });
  else updateProcess(process.id, { x: side === "left" ? 8 : Math.max(8, rect.width / 2), y: 8, width: Math.max(320, rect.width / 2 - 12), height: rect.height - 16, maximized: false });
  focusProcess(process.id);
}

function containingPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}` || "/";
}

function closeContextMenu() {
  contextMenu?.remove();
  contextMenu = null;
}

function showContextMenu(x: number, y: number, items: MenuItem[]) {
  closeContextMenu();
  contextMenu = el("div", "fixed z-[9300] grid min-w-56 gap-1 rounded-2xl border border-white/15 bg-slate-950/92 p-2 text-sm text-white shadow-2xl shadow-black/45 backdrop-blur-2xl");
  items.forEach((item) => {
    const row = el("button", "grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-3 py-2 text-left text-white/78 transition hover:bg-white/10 hover:text-white", { type: "button" });
    append(row, [el("span", "truncate", { text: item.label }), el("span", "font-mono text-xs text-white/35", { text: item.shortcut || "" })]);
    row.addEventListener("click", () => {
      item.action();
      closeContextMenu();
    });
    contextMenu?.append(row);
  });
  root.append(contextMenu);
  const rect = contextMenu.getBoundingClientRect();
  contextMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  contextMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
}

function appContext(process: ProcessRecord): AppContext {
  return {
    process,
    launchApp,
    closeProcess,
    updateTitle: (title: string) => updateProcess(process.id, { title }),
    openExternal,
    openNode,
    notify
  };
}

function makeBoot() {
  const boot = el("div", "fixed inset-0 z-[9999] grid content-end gap-4 bg-[radial-gradient(circle_at_22%_18%,rgba(128,247,255,.16),transparent_28%),linear-gradient(180deg,rgba(3,5,10,.98),rgba(6,8,16,.94))] p-[clamp(22px,5vw,56px)] transition duration-500");
  const logo = el("h1", "m-0 font-mono text-[clamp(2.2rem,8vw,7rem)] font-black tracking-[-.08em]", { text: "BlairOS" });
  const log = el("div", "min-h-36 w-[min(680px,100%)] font-mono text-sm text-white/65");
  const bar = el("div", "h-2 w-[min(680px,100%)] overflow-hidden rounded-full border border-white/15 bg-white/10");
  const fill = el("span", "block h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300 transition-all duration-200");
  bar.append(fill);
  append(boot, [logo, log, bar]);
  root.append(boot);

  const lines = ["mount /Desktop", "load /Applications", "hydrate /bin", "start windowserver", "ready"];
  lines.forEach((line, index) => {
    window.setTimeout(() => {
      log.append(el("p", "mb-1", { text: `[ok] ${line}` }));
      fill.style.width = `${((index + 1) / lines.length) * 100}%`;
      if (index === lines.length - 1) {
        window.setTimeout(() => {
          boot.classList.add("opacity-0", "invisible", "pointer-events-none");
          if (!restoreSession()) {
            launchApp("browser", { url: "https://blairhudson.com/agile-weekend/" });
            launchApp("terminal");
            launchApp("browser", { url: "https://blairhudson.com/sbx-agents/" });
            const browserProcess = processes.get().at(-1);
            if (browserProcess?.appId === "browser") {
              updateProcess(browserProcess.id, { x: Math.max(24, window.innerWidth - browserProcess.width - 40), y: 72 });
            }
            launchApp("files", { path: "/Home/blair/Links" });
          }
        }, 420);
      }
    }, 180 + index * 190);
  });
}

function makeMenuBar() {
  const menu = el("header", "fixed inset-x-0 top-0 z-[7000] grid h-[var(--menu-height)] grid-cols-[1fr_auto] items-center gap-3 border-b border-white/10 bg-slate-950/70 px-3 text-[0.82rem] backdrop-blur-2xl");
  const left = el("div", "flex min-w-0 items-center gap-1 overflow-hidden");
  let openDropdown: HTMLElement | null = null;
  let openDropdownAnchor: HTMLElement | null = null;
  const menuButtonClass = "rounded-md px-2 py-1 font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/40";
  const mark = el("button", `${menuButtonClass} mr-1 font-black tracking-[-.04em] text-white`, { type: "button", text: "BlairOS" });
  activeApp = el("button", `${menuButtonClass} max-w-36 truncate font-bold text-white/85 max-sm:hidden`, { type: "button", text: "Finder" });
  let markClicks = 0;
  let markTimer: number | undefined;
  mark.addEventListener("click", () => {
    markClicks += 1;
    window.clearTimeout(markTimer);
    markTimer = window.setTimeout(() => (markClicks = 0), 900);
    if (markClicks >= 3) {
      markClicks = 0;
      unlockDebugStickers();
    }
  });

  function closeMenu() {
    openDropdown?.remove();
    openDropdown = null;
    openDropdownAnchor = null;
  }

  function showMenu(button: HTMLElement, items: MenuItem[]) {
    if (openDropdown) {
      const sameButton = openDropdownAnchor === button;
      closeMenu();
      if (sameButton) return;
    }
    const rect = button.getBoundingClientRect();
    openDropdown = el("div", "fixed z-[9200] grid min-w-56 gap-1 rounded-2xl border border-white/15 bg-slate-950/90 p-2 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-2xl");
    openDropdownAnchor = button;
    openDropdown.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 240))}px`;
    openDropdown.style.top = `${rect.bottom + 6}px`;
    items.forEach((item) => {
      const row = el("button", "grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-3 py-2 text-left text-white/78 transition hover:bg-white/10 hover:text-white", { type: "button" });
      append(row, [el("span", "truncate", { text: item.label }), el("span", "font-mono text-xs text-white/35", { text: item.shortcut || "" })]);
      row.addEventListener("click", () => {
        item.action();
        closeMenu();
      });
      openDropdown?.append(row);
    });
    root.append(openDropdown);
  }

  function menuButton(label: string, items: MenuItem[]) {
    const button = el("button", menuButtonClass, { type: "button", text: label });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      showMenu(button, items);
    });
    return button;
  }

  function fileItems(): MenuItem[] {
    return [
      { label: "New Terminal", shortcut: "Ctrl+Cmd Space", action: () => launchApp("terminal") },
      { label: "New Browser Window", action: () => launchApp("browser") },
      { label: "New Files Window", action: () => launchApp("files", { path: "/Home/blair" }) }
    ];
  }

  mark.addEventListener("click", (event) => {
    event.stopPropagation();
    const recentItems = getRecentItems().slice(0, 5).map((item) => ({ label: item.title, action: () => runRecent(item) }));
    showMenu(mark, [
      { label: "About BlairOS", action: () => launchApp("about") },
      { label: "System Settings", shortcut: "Cmd+,", action: () => launchApp("settings") },
      { label: "Launcher", shortcut: "Cmd+K", action: openLauncher },
      ...recentItems,
      { label: "Clear Recent Items", action: clearRecentItems },
      { label: "Sleep", action: () => notify("Display sleeping. Move pointer or press key to wake.") }
    ]);
  });

  activeApp.addEventListener("click", (event) => {
    event.stopPropagation();
    const process = focusedProcess();
    const appName = process ? appRegistry[process.appId].name : "Finder";
    showMenu(activeApp, process ? [
      { label: `About ${appName}`, action: () => process.appId === "about" ? notify("Already viewing About BlairOS") : launchApp("about") },
      { label: `New ${appName} Window`, action: () => launchApp(process.appId, process.data ?? {}) },
      ...fileItems(),
      { label: "Minimize", shortcut: "Cmd+M", action: () => minimizeProcess(process.id) },
      { label: process.maximized ? "Exit Full Window" : "Full Window", action: () => toggleMaximizeProcess(process.id) },
      { label: "Close Window", shortcut: "Cmd+W", action: () => closeProcess(process.id) }
    ] : [
      { label: "About BlairOS", action: () => launchApp("about") },
      ...fileItems(),
      { label: "Open Launcher", shortcut: "Cmd+K", action: openLauncher },
      { label: "Show Desktop", action: () => launchApp("files", { path: "/Desktop" }) }
    ]);
  });

  const editMenu = menuButton("Edit", [
    { label: "Copy", shortcut: "Cmd+C", action: () => notify("Copy") },
    { label: "Paste", shortcut: "Cmd+V", action: () => notify("Paste") },
    { label: "Select All", shortcut: "Cmd+A", action: () => notify("Select All delegated to active app") }
  ]);
  const viewMenu = menuButton("View", [
    { label: "Toggle Full Window", action: () => { const process = focusedProcess(); if (process) toggleMaximizeProcess(process.id); } },
    { label: "Minimize", shortcut: "Cmd+M", action: () => { const process = focusedProcess(); if (process) minimizeProcess(process.id); } },
    { label: "Open Launcher", shortcut: "Cmd+K", action: openLauncher }
  ]);
  const goMenu = menuButton("Go", [
    { label: "Desktop", action: () => launchApp("files", { path: "/Desktop" }) },
    { label: "Projects", action: () => launchApp("files", { path: "/Projects" }) },
    { label: "Applications", action: () => launchApp("files", { path: "/Applications" }) },
    { label: "Browser Home", action: () => launchApp("browser", { url: "blairos://home" }) }
  ]);
  const windowMenu = menuButton("Window", [
    { label: "Bring Frontmost Forward", action: () => { const process = focusedProcess(); if (process) focusProcess(process.id); } },
    { label: "Restore Minimized", action: () => processes.get().filter((process) => process.minimized).forEach((process) => restoreProcess(process.id)) },
    { label: "Close All", action: () => processes.get().forEach((process) => closeProcess(process.id)) }
  ]);
  const helpMenu = menuButton("Help", [
    { label: "About BlairOS", action: () => launchApp("about") },
    { label: "Terminal Help", action: () => launchApp("terminal", { command: "help" }) },
    { label: "Keyboard Shortcuts", action: () => notify("Cmd+K launcher, Cmd+Space terminal, window dots control close/min/max") }
  ]);

  document.addEventListener("click", closeMenu);
  append(left, [mark, activeApp, editMenu, viewMenu, goMenu, windowMenu, helpMenu]);

  const right = el("div", "flex items-center justify-end gap-2 text-white/70");
  const search = append(el("button", "grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/8 text-white/75 transition hover:border-white/20 hover:bg-white/15", { type: "button", title: "Search" }), [icon("ph-magnifying-glass", "text-base")]);
  search.addEventListener("click", openLauncher);
  const user = append(el("button", "flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/15 max-sm:hidden", { type: "button", title: "blair" }), [icon("ph-user-circle", "text-base"), "blair"]);
  user.addEventListener("click", (event) => {
    event.stopPropagation();
    showMenu(user, [
      { label: "Open Profile", action: () => launchApp("about") },
      { label: "Home Folder", action: () => launchApp("files", { path: "/Home/blair" }) },
      { label: "System Settings", shortcut: "Cmd+,", action: () => launchApp("settings") },
      { label: "Start Screensaver", action: () => startScreensaver() },
      { label: "Lock Screen", action: showLockScreen }
    ]);
  });
  const wifi = append(el("button", "grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/8 text-white/75 transition hover:border-white/20 hover:bg-white/15", { type: "button", title: "Wi-Fi connected" }), [icon("ph-wifi-high", "text-base")]);
  wifi.addEventListener("click", (event) => {
    event.stopPropagation();
    showMenu(wifi, [
      { label: "Open Network Utility", action: () => launchApp("networkUtility") },
      { label: "Run Diagnostics", action: () => runJob("Network diagnostics", "networkd", "checking signal and DNS", () => launchApp("networkUtility", { tool: "ping" })) },
      { label: "Reconnect Wi-Fi", action: () => runJob("Wi-Fi reconnect", "airportd", "renewing link", () => notify("Wi-Fi connected")) }
    ]);
  });
  const battery = append(el("button", "flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1 font-mono text-xs text-white/75 transition hover:border-white/20 hover:bg-white/15", { type: "button", title: "Battery 92%" }), [icon("ph-battery-full", "text-base text-emerald-200"), "92%"]);
  battery.addEventListener("click", (event) => {
    event.stopPropagation();
    showMenu(battery, [
      { label: "Battery: 92%", action: () => notify("Battery 92%, healthy") },
      { label: "Open System Profiler", action: () => launchApp("systemProfiler") },
      { label: "Open Activity Monitor", action: () => launchApp("activityMonitor") },
      { label: "Low Power Mode", action: () => notify("Low Power Mode scheduled for later") }
    ]);
  });
  const clock = el("button", "rounded-md px-2 py-1 font-mono transition hover:bg-white/10", { type: "button" });
  clock.addEventListener("click", (event) => {
    event.stopPropagation();
    showNotificationCenter(clock);
  });
  const tick = () => (clock.textContent = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", weekday: "short", hour12: !settings.get().clock24h }).format(new Date()));
  settings.subscribe(tick);
  tick();
  window.setInterval(tick, 15000);
  append(right, [search, user, wifi, battery, clock]);
  append(menu, [left, right]);
  root.append(menu);
}

function makeDesktop() {
  const desktop = el("main", "fixed inset-x-0 bottom-[var(--dock-height)] top-[var(--menu-height)] p-5 max-sm:p-4");
  const grid = el("div", "grid max-h-full w-max auto-cols-[92px] grid-flow-col grid-rows-6 gap-3 max-sm:w-full max-sm:grid-flow-row max-sm:grid-cols-3 max-sm:grid-rows-none");
  desktopNodes().forEach((node) => {
    const item = el("button", "grid min-h-[90px] w-[92px] content-start justify-items-center gap-2 rounded-2xl border border-transparent px-1.5 py-2.5 text-center text-xs leading-4 transition hover:border-white/15 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 max-sm:w-auto", { type: "button" });
    item.dataset.fsPath = node.path;
    append(item, [icon(node.icon, "text-4xl text-cyan-100 drop-shadow"), el("span", "max-w-full break-words [text-shadow:0_1px_8px_rgba(0,0,0,.8)]", { text: node.name })]);
    bindFsDrag(item, node);
    item.addEventListener("dblclick", () => openNode(node));
    item.addEventListener("click", () => notify(`${node.name} selected. Double-click to open.`));
    grid.append(item);
  });
  desktop.append(grid);
  root.append(desktop);
}

function makeDock() {
  dock = el("nav", "fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[7500] flex max-w-[calc(100vw-22px)] -translate-x-1/2 items-end gap-2 rounded-[26px] border border-white/15 bg-slate-950/55 p-2.5 shadow-2xl shadow-black/40 backdrop-blur-2xl max-sm:w-[calc(100vw-16px)] max-sm:justify-center max-sm:overflow-x-auto");
  root.append(dock);
}

function renderDock() {
  const running = new Set(processes.get().map((process) => process.appId));
  const minimized = new Set(processes.get().filter((process) => process.minimized).map((process) => process.appId));
  dock.replaceChildren();
  appManifests.filter((app) => dockAppIds.includes(app.id) || running.has(app.id)).forEach((app) => {
    const item = el("button", `group relative flex h-14 w-14 flex-none items-center justify-center rounded-2xl border border-white/10 bg-white/10 transition hover:-translate-y-1 hover:bg-white/20 max-sm:h-12 max-sm:w-12 ${running.has(app.id) ? "after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full" : ""} ${minimized.has(app.id) ? "border-amber-200/30 after:bg-amber-300" : "after:bg-cyan-300"}`, { type: "button", title: minimized.has(app.id) ? `${app.name} minimized - click to restore` : app.name });
    item.dataset.appId = app.id;
    item.append(icon(app.icon, "block text-3xl leading-none"));
    item.append(el("span", "pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/15 bg-slate-950/90 px-2.5 py-1 text-xs font-bold text-white shadow-xl group-hover:block", { text: app.name }));
    item.addEventListener("click", () => {
      const existing = processes.get().find((process) => process.appId === app.id);
      existing ? restoreProcess(existing.id) : launchApp(app.id);
    });
    dock.append(item);
  });
}

function searchItems(): SearchItem[] {
  const apps = appManifests.map((app) => ({ id: `app:${app.id}`, title: app.name, subtitle: "Application", icon: app.icon, kind: "app" as const, action: () => launchApp(app.id) }));
  const files = searchableNodes().map((node) => ({ id: `fs:${node.path}`, title: node.name, subtitle: node.path, icon: node.icon, kind: node.type === "program" ? "program" as const : node.type === "link" ? "link" as const : "file" as const, action: () => node.type === "program" ? launchApp("terminal", { command: `${node.name} --help` }) : openNode(node) }));
  const recents = getRecentItems().map((item) => ({ id: `recent:${item.id}`, title: item.title, subtitle: `Recent - ${item.subtitle}`, icon: item.icon, kind: item.kind === "command" ? "program" as const : item.kind === "url" ? "link" as const : item.kind, action: () => runRecent(item) }));
  return [...recents, ...apps, ...files];
}

function naturalActions(query: string): SearchItem[] {
  const q = query.toLowerCase();
    const actions: SearchItem[] = [];
    if (/^new note|note /.test(q)) actions.push({ id: "action:new-note", title: "New note", subtitle: "Create note", icon: "ph-notebook", kind: "action", action: () => launchApp("notes") });
    if (/notification|alerts|jobs/.test(q)) actions.push({ id: "action:notifications", title: "Notification Center", subtitle: "Notifications and background jobs", icon: "ph-bell", kind: "action", action: () => showNotificationCenter() });
    if (/screenshot|capture/.test(q)) actions.push({ id: "action:screenshot", title: "Take screenshot", subtitle: "Save image to Desktop", icon: "ph-camera", kind: "action", action: takeScreenshot });
    if (/lock|sleep/.test(q)) actions.push({ id: "action:lock", title: "Lock screen", subtitle: "Sleep display", icon: "ph-lock", kind: "action", action: showLockScreen });
    if (/console|logs|log/.test(q)) actions.push({ id: "action:logs", title: "Open Console", subtitle: "System logs", icon: "ph-list-magnifying-glass", kind: "action", action: () => launchApp("console") });
    if (/activity|process|jobs/.test(q)) actions.push({ id: "action:activity", title: "Open Activity Monitor", subtitle: "Processes and jobs", icon: "ph-pulse", kind: "action", action: () => launchApp("activityMonitor") });
    if (/open old|old homepage/.test(q)) actions.push({ id: "action:old-home", title: "Open old homepage", subtitle: "/old-homepage.html", icon: "ph-file-html", kind: "action", action: () => launchApp("browser", { url: "/old-homepage.html" }) });
  if (/find projects|projects/.test(q)) actions.push({ id: "action:projects", title: "Find projects", subtitle: "/Projects", icon: "ph-folder", kind: "action", action: () => launchApp("files", { path: "/Projects" }) });
  if (/email|mail blair|contact/.test(q)) actions.push({ id: "action:email", title: "Email Blair", subtitle: "Open Mail", icon: "ph-envelope-simple", kind: "action", action: () => launchApp("mail") });
  if (/git|repo|commit/.test(q)) actions.push({ id: "action:git", title: "Open Git", subtitle: "Repos and commits", icon: "ph-git-branch", kind: "action", action: () => launchApp("git") });
  return actions;
}

function makeLauncher() {
  launcher = el("div", "fixed inset-0 z-[9000] hidden place-items-start justify-center bg-black/25 pt-[11vh] backdrop-blur-sm");
  const panel = el("div", `${glass} w-[min(720px,calc(100vw-26px))] overflow-hidden rounded-[28px]`);
  launcherInput = el("input", "w-full border-0 border-b border-white/15 bg-transparent px-5 py-5 text-lg text-white outline-none placeholder:text-white/35", { placeholder: "Search apps, files, links, /bin..." }) as HTMLInputElement;
  launcherResults = el("div", "grid max-h-[min(520px,58vh)] gap-1 overflow-auto p-2");
  append(panel, [launcherInput, launcherResults]);
  launcher.append(panel);
  launcher.addEventListener("click", (event) => {
    if (event.target === launcher) closeLauncher();
  });
  launcherInput.addEventListener("input", renderLauncherResults);
  launcherInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") (launcherResults.querySelector("button") as HTMLButtonElement | null)?.click();
  });
  root.append(launcher);
}

function openLauncher() {
  launcher.classList.remove("hidden");
  launcher.classList.add("grid");
  launcherInput.value = "";
  renderLauncherResults();
  launcherInput.focus();
}

function closeLauncher() {
  launcher.classList.add("hidden");
  launcher.classList.remove("grid");
}

function renderLauncherResults() {
  const items = searchItems();
  const query = launcherInput.value.trim();
  const results = query ? [...naturalActions(query), ...new Fuse(items, { keys: ["title", "subtitle", "kind"], threshold: 0.34 }).search(query).map((result) => result.item)] : items.slice(0, 12);
  launcherResults.replaceChildren();
  results.slice(0, 18).forEach((item) => {
    const row = el("button", "grid grid-cols-[46px_1fr_auto] items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40", { type: "button" });
    append(row, [icon(item.icon, "text-3xl text-cyan-100"), append(el("span", "min-w-0"), [el("span", "block truncate font-semibold", { text: item.title }), el("span", "block truncate text-xs text-white/45", { text: item.subtitle })]), el("span", "font-mono text-xs uppercase text-white/40", { text: item.kind })]);
    row.addEventListener("click", () => {
      item.action();
      closeLauncher();
    });
    launcherResults.append(row);
  });
}

function makeWindowLayer() {
  windowLayer = el("section", "pointer-events-none fixed inset-x-0 bottom-[var(--dock-height)] top-[var(--menu-height)] max-sm:grid max-sm:items-stretch max-sm:overflow-auto max-sm:p-2");
  root.append(windowLayer);
}

function renderWindows() {
  const focused = focusedProcessId.get();
  const current = new Map([...windowLayer.querySelectorAll<HTMLElement>("[data-process]")].map((node) => [node.dataset.process!, node]));

  for (const process of processes.get()) {
    const existing = current.get(process.id);
    if (existing) {
      syncWindow(existing, process, focused === process.id);
      current.delete(process.id);
      continue;
    }
    const node = createWindow(process);
    windowLayer.append(node);
    syncWindow(node, process, focused === process.id);
  }

  current.forEach((node) => node.remove());
  const activeProcess = focused ? processes.get().find((process) => process.id === focused) : undefined;
  activeApp.textContent = activeProcess ? appRegistry[activeProcess.appId].name : "Finder";
  renderDock();
}

function createWindow(process: ProcessRecord) {
  const app = appRegistry[process.appId];
  const win = el("article", `${glass} pointer-events-auto absolute grid min-h-60 min-w-80 grid-rows-[42px_1fr] overflow-hidden rounded-[22px] max-sm:relative max-sm:!left-auto max-sm:!top-auto max-sm:!h-[calc(100vh-var(--menu-height)-var(--dock-height)-16px)] max-sm:!w-full max-sm:!translate-x-0 max-sm:!translate-y-0`);
  win.dataset.process = process.id;
  const titlebar = el("header", "window-drag grid cursor-grab select-none grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/15 bg-white/5 px-3");
  const controls = el("div", "flex gap-2");
  const controlClass = "h-3.5 w-3.5 rounded-full border border-black/20 transition hover:scale-125 hover:brightness-125 hover:ring-2 hover:ring-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-200/70";
  const close = el("button", `${controlClass} bg-[#ff5f57] hover:shadow-[0_0_12px_rgba(255,95,87,.7)]`, { type: "button", title: "close" });
  const min = el("button", `${controlClass} bg-[#ffbd2e] hover:shadow-[0_0_12px_rgba(255,189,46,.7)]`, { type: "button", title: "minimize to Dock" });
  const max = el("button", `${controlClass} bg-[#28c840] hover:shadow-[0_0_12px_rgba(40,200,64,.7)]`, { type: "button", title: "maximize" });
  close.addEventListener("click", () => closeProcess(process.id));
  min.addEventListener("click", () => minimizeProcess(process.id));
  max.addEventListener("click", () => toggleMaximizeProcess(process.id));
  append(controls, [close, min, max]);
  const titleLabel = append(el("div", "truncate text-sm font-bold text-white/75", { "data-window-title": "true" }), [icon(process.icon, "mr-2 inline text-lg text-cyan-200"), process.title]);
  append(titlebar, [controls, titleLabel, el("span", "font-mono text-[0.68rem] text-white/35", { text: process.id })]);
  const content = el("div", "relative min-h-0 overflow-auto");
  content.append(app.render(appContext(process)));
  if (process.appId === "browser") {
    const focusShield = el("div", "absolute inset-0 z-10 cursor-default bg-transparent", { "data-focus-shield": "true" });
    focusShield.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      focusProcess(process.id);
    });
    content.append(focusShield);
  }
  append(win, [titlebar, content]);
  win.addEventListener("pointerdown", () => focusProcess(process.id));
  attachInteract(win, process.id);
  return win;
}

function syncWindow(win: HTMLElement, process: ProcessRecord, isFocused: boolean) {
  win.classList.toggle("hidden", process.minimized || (window.matchMedia("(max-width: 720px)").matches && !isFocused));
  win.classList.toggle("ring-1", isFocused);
  win.classList.toggle("ring-cyan-200/35", isFocused);
  win.querySelector<HTMLElement>("[data-focus-shield]")?.classList.toggle("hidden", isFocused);
  const titleLabel = win.querySelector<HTMLElement>("[data-window-title]");
  if (titleLabel) titleLabel.replaceChildren(icon(process.icon, "mr-2 inline text-lg text-cyan-200"), process.title);
  win.style.zIndex = String(process.z);
  if (process.maximized) {
    win.style.left = "8px";
    win.style.top = "8px";
    win.style.width = "calc(100% - 16px)";
    win.style.height = "calc(100% - 16px)";
  } else {
    win.style.left = `${process.x}px`;
    win.style.top = `${process.y}px`;
    win.style.width = `${process.width}px`;
    win.style.height = `${process.height}px`;
  }
}

function attachInteract(win: HTMLElement, processId: string) {
  interact(win)
    .draggable({
      allowFrom: ".window-drag",
      ignoreFrom: "button,input",
      modifiers: [interact.modifiers.restrictRect({ restriction: "parent" })],
      listeners: {
        move(event) {
          const process = processes.get().find((item) => item.id === processId);
          if (!process || process.maximized) return;
          updateProcess(processId, { x: process.x + event.dx, y: process.y + event.dy });
        }
      }
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 320, height: 240 } })],
      listeners: {
        move(event) {
          const process = processes.get().find((item) => item.id === processId);
          if (!process || process.maximized) return;
          updateProcess(processId, {
            x: process.x + event.deltaRect.left,
            y: process.y + event.deltaRect.top,
            width: event.rect.width,
            height: event.rect.height
          });
        }
      }
    });
}

function bindContextMenus() {
  document.addEventListener("click", closeContextMenu);
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    const fsTarget = target.closest<HTMLElement>("[data-fs-path]");
    const appTarget = target.closest<HTMLElement>("[data-app-id]");
    const processTarget = target.closest<HTMLElement>("[data-process]");

    if (fsTarget?.dataset.fsPath) {
      const node = findNode(fsTarget.dataset.fsPath);
      if (!node) return;
      const meta = metadataFor(node.path);
      const canPaste = node.type === "folder" || node.type === "trash";
      showContextMenu(event.clientX, event.clientY, [
        { label: `Open ${node.name}`, action: () => openNode(node) },
        ...openWithItems(node),
        { label: "Show in Files", action: () => launchApp("files", { path: node.type === "folder" || node.type === "trash" ? node.path : containingPath(node.path) }) },
        { label: meta.favorite ? "Remove Favorite" : "Add Favorite", action: () => notify(toggleFavorite(node.path) ? `${node.name} favorited` : `${node.name} unfavorited`) },
        { label: "Set Tags", action: () => { const value = prompt("Tags", (meta.tags ?? []).join(", ")); if (value !== null) setTags(node.path, value.split(",")); } },
        { label: "Add Comment", action: () => { const value = prompt("Comment", meta.comment ?? ""); if (value !== null) setComment(node.path, value); } },
        { label: "Copy", shortcut: "Cmd+C", action: () => { clipboardPath = node.path; notify(`${node.name} copied`); } },
        ...(canPaste ? [{ label: "Paste", shortcut: "Cmd+V", action: () => pasteInto(node.path) }] : []),
        { label: "Move to Trash", action: () => { const error = removeNode(node.path); notify(error ? `Delete failed: ${error}` : `${node.name} moved to Trash`); } }
      ]);
      return;
    }

    if (appTarget?.dataset.appId) {
      const appId = appTarget.dataset.appId as AppId;
      const app = appRegistry[appId];
      const process = processes.get().find((item) => item.appId === appId);
      showContextMenu(event.clientX, event.clientY, [
        { label: process?.minimized ? `Restore ${app.name}` : `Open ${app.name}`, action: () => process ? restoreProcess(process.id) : launchApp(appId) },
        { label: `New ${app.name} Window`, action: () => launchApp(appId) },
        { label: `Quit ${app.name}`, action: () => processes.get().filter((item) => item.appId === appId).forEach((item) => closeProcess(item.id)) }
      ]);
      return;
    }

    if (processTarget?.dataset.process) {
      const process = processes.get().find((item) => item.id === processTarget.dataset.process);
      if (!process) return;
      showContextMenu(event.clientX, event.clientY, [
        { label: "Bring to Front", action: () => focusProcess(process.id) },
        { label: "Snap Left", action: () => snapProcess(process, "left") },
        { label: "Snap Right", action: () => snapProcess(process, "right") },
        { label: "Fill Screen", action: () => snapProcess(process, "top") },
        { label: "Minimize", shortcut: "Cmd+M", action: () => minimizeProcess(process.id) },
        { label: process.maximized ? "Exit Full Window" : "Full Window", action: () => toggleMaximizeProcess(process.id) },
        { label: "Close Window", shortcut: "Cmd+W", action: () => closeProcess(process.id) }
      ]);
      return;
    }

    showContextMenu(event.clientX, event.clientY, [
      { label: "Open Launcher", shortcut: "Cmd+K", action: openLauncher },
      { label: "New Terminal", action: () => launchApp("terminal") },
      { label: "New Files Window", action: () => launchApp("files", { path: "/Desktop" }) },
      { label: "Paste to Desktop", shortcut: "Cmd+V", action: () => pasteInto("/Desktop") },
      { label: "Take Screenshot", action: takeScreenshot },
      { label: "Lock Screen", action: showLockScreen },
      { label: "Change Wallpaper", action: () => launchApp("settings") }
    ]);
  });
}

function bindKeys() {
  document.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") {
      closeLauncher();
      closeContextMenu();
      return;
    }
    if (!mod) return;

    const key = event.key.toLowerCase();
    const process = focusedProcess();
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (key === "k") {
      handled();
      openLauncher();
      return;
    }
    if (event.code === "Space") {
      handled();
      launchApp("terminal");
      return;
    }
    if (key === ",") {
      handled();
      launchApp("settings");
      return;
    }
    if (key === "n") {
      handled();
      process ? launchApp(process.appId, process.data ?? {}) : launchApp("files", { path: "/Desktop" });
      return;
    }
    if (key === "w") {
      handled();
      if (process) closeProcess(process.id);
      return;
    }
    if (key === "c") {
      handled();
      const process = focusedProcess();
      const path = process?.data?.path;
      if (typeof path === "string") {
        clipboardPath = path;
        notify(`${path} copied`);
      } else notify("Copy captured");
      return;
    }
    if (key === "v") {
      handled();
      const process = focusedProcess();
      const target = typeof process?.data?.path === "string" ? process.data.path : "/Desktop";
      pasteInto(target);
      return;
    }
    if (key === "p") {
      handled();
      takeScreenshot();
      return;
    }
    if (key === "l") {
      handled();
      showLockScreen();
      return;
    }
    if (key === "m") {
      handled();
      if (process) minimizeProcess(process.id);
      return;
    }
    if (key === "q") {
      handled();
      if (process) processes.get().filter((item) => item.appId === process.appId).forEach((item) => closeProcess(item.id));
      return;
    }
    if (key === "`") {
      handled();
      const list = processes.get().filter((item) => !item.minimized);
      if (list.length > 1 && process) focusProcess(list[(list.findIndex((item) => item.id === process.id) + 1) % list.length].id);
      return;
    }
    if (["s", "r", "p", "o", "l", "t", "h", "f", "g"].includes(key)) {
      handled();
      notify(`Cmd+${key.toUpperCase()} captured by BlairOS`);
    }
  });
}

function bindEasterEggs() {
  const konami = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  const buffer: string[] = [];
  window.addEventListener("keydown", (event) => {
    buffer.push(event.key.toLowerCase());
    buffer.splice(0, Math.max(0, buffer.length - konami.length));
    if (buffer.join("/") !== konami.join("/")) return;
    buffer.length = 0;
    localStorage.setItem("blairos.agentMode", "unlocked");
    showEasterOverlay("AGENT MODE UNLOCKED", "Wallpaper harmonics shifted. The local agents are pretending not to notice.");
    notify("Agent mode unlocked");
  });
}

bindSettings();
makeMenuBar();
makeDesktop();
makeWindowLayer();
makeDock();
makeLauncher();
bindKeys();
bindEasterEggs();
bindContextMenus();
bindIdleScreensaver();
processes.subscribe(renderWindows);
focusedProcessId.subscribe(renderWindows);
makeBoot();
