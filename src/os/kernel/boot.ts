import Fuse from "fuse.js";
import { toCanvas } from "html-to-image";
import interact from "interactjs";
import { appManifests, appRegistry } from "./apps";
import { append, bindButtonAction, el, glass, icon } from "./dom";
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
import type { AppId, AppContext, NotifyAction, ProcessRecord } from "./types";
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
  action?: () => void;
};

const root = document.getElementById("os-root")!;
if (!root) throw new Error("missing #os-root");

type BootWindow = Window & { __blairosBootSeen?: boolean };
type BootStep = {
  label: string;
  detail: string | (() => string);
  action?: () => string | void;
};

let windowLayer: HTMLElement;
let dock: HTMLElement;
let activeApp: HTMLElement;
let launcher: HTMLElement;
let launcherResults: HTMLElement;
let launcherInput: HTMLInputElement;
let contextMenu: HTMLElement | null = null;
let notificationPanel: HTMLElement | null = null;
let osKeyboard: HTMLElement;
let osKeyboardShifted = false;
let osKeyboardPinned = false;
let keyboardMode: "os" | "native" = localStorage.getItem("blairos.keyboardMode") === "native" ? "native" : "os";
let toastTimer: number | undefined;
let clipboardPath = "";
let screensaver: HTMLElement | null = null;
let idleTimer: number | undefined;
const dockAppIds: AppId[] = ["files", "browser", "terminal", "code", "sheets", "notes", "preview", "activityMonitor", "settings", "trash"];

function isSmallScreen() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function notify(message: string, action?: NotifyAction) {
  addNotification(message);
  logEvent("notification", message);
  const existing = document.querySelector("[data-toast]");
  existing?.remove();
  const toast = el("div", "fixed bottom-[calc(var(--dock-height)+16px)] right-4 z-[9500] grid max-w-[min(420px,calc(100vw-28px))] gap-3 rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-3 text-sm text-white/70 shadow-2xl backdrop-blur-2xl");
  toast.append(el("span", "break-words", { text: message }));
  if (action) {
    const actionButton = el("button", "justify-self-start rounded-xl border border-cyan-200/25 bg-cyan-300/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/25", { type: "button", text: action.label });
    bindButtonAction(actionButton, (event) => {
      event.stopPropagation();
      toast.remove();
      action.action();
    });
    toast.append(actionButton);
  }
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
  bindButtonAction(card.lastElementChild as HTMLButtonElement, () => { window.clearInterval(timer); overlay.remove(); notify("Session unlocked"); });
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

function closeNotificationCenter() {
  notificationPanel?.remove();
  notificationPanel = null;
}

function showNotificationCenter(anchor?: HTMLElement) {
  closeNotificationCenter();
  closeContextMenu();
  const items = notifications.get();
  const activeJobs = jobs.get();
  notificationPanel = el("aside", "fixed right-3 top-[calc(var(--menu-height)+8px)] z-[9400] grid max-h-[min(680px,calc(100vh-90px))] w-[min(390px,calc(100vw-24px))] max-w-[calc(100vw-24px)] grid-rows-[auto_1fr_auto] gap-3 overflow-x-hidden overflow-y-hidden rounded-[30px] border border-white/15 bg-slate-950/90 p-4 text-white shadow-2xl shadow-black/45 backdrop-blur-2xl");
  append(notificationPanel, [el("h2", "min-w-0 truncate text-2xl font-black tracking-[-0.07em]", { text: "Notification Center" })]);
  const list = el("div", "grid min-w-0 gap-2 overflow-x-hidden overflow-y-auto pr-1");
  activeJobs.forEach((job) => {
    const progress = el("span", "block h-full rounded-full bg-cyan-300");
    progress.style.width = `${job.progress}%`;
    list.append(append(el("article", "min-w-0 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3"), [
      el("p", "break-words font-bold", { text: job.name }),
      el("p", "break-words text-xs text-white/45", { text: `${job.app} - ${job.state} - ${job.detail ?? ""}` }),
      append(el("div", "mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"), [progress])
    ]));
  });
  items.forEach((item) => list.append(append(el("article", "min-w-0 rounded-2xl border border-white/10 bg-white/8 p-3"), [
    el("p", "break-words text-sm text-white/80", { text: item.message }),
    el("p", "mt-1 break-words font-mono text-[0.68rem] text-white/35", { text: item.time })
  ])));
  if (!activeJobs.length && !items.length) list.append(el("p", "min-w-0 rounded-2xl border border-white/10 bg-white/8 p-4 text-white/50", { text: "No notifications" }));
  const footer = el("div", "flex min-w-0 gap-2");
  append(footer, [el("button", "rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20", { type: "button", text: "Clear" }), el("button", "rounded-2xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200", { type: "button", text: "Open Console" })]);
  bindButtonAction(footer.firstElementChild as HTMLButtonElement, () => { clearNotifications(); closeNotificationCenter(); });
  bindButtonAction(footer.lastElementChild as HTMLButtonElement, () => { launchApp("console"); closeNotificationCenter(); });
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
  bindButtonAction(card.lastElementChild as HTMLButtonElement, () => overlay.remove());
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
  contextMenu = el("div", "fixed z-[9300] grid min-w-56 gap-1 rounded-2xl border border-white/15 bg-slate-950/92 p-2 text-sm text-white shadow-2xl shadow-black/45 backdrop-blur-2xl max-sm:max-h-[calc(100dvh-16px)] max-sm:w-[calc(100vw-16px)] max-sm:overflow-auto");
  items.forEach((item) => {
    const action = item.action;
    if (!action) return;
    const row = el("button", "grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-3 py-2 text-left text-white/78 transition hover:bg-white/10 hover:text-white", { type: "button" });
    append(row, [el("span", "truncate", { text: item.label }), el("span", "font-mono text-xs text-white/35", { text: item.shortcut || "" })]);
    bindButtonAction(row, () => {
      action();
      closeContextMenu();
    });
    contextMenu?.append(row);
  });
  root.append(contextMenu);
  const rect = contextMenu.getBoundingClientRect();
  contextMenu.style.left = isSmallScreen() ? "8px" : `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  contextMenu.style.top = isSmallScreen() ? "8px" : `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
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

function restoreOrLaunchSession() {
  if (restoreSession()) return "restored saved windows and focus state";
  launchApp("browser", { url: "https://blairhudson.com/agile-weekend/" });
  launchApp("terminal");
  launchApp("browser", { url: "https://blairhudson.com/sbx-agents/" });
  const browserProcess = processes.get().at(-1);
  if (browserProcess?.appId === "browser") {
    updateProcess(browserProcess.id, { x: Math.max(24, window.innerWidth - browserProcess.width - 40), y: 72 });
  }
  launchApp("files", { path: "/Home/blair/Links" });
  return "no saved session, launched Browser, Terminal, and Links";
}

function legacyRestoreOrLaunchSession() {
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
}

function makeBoot() {
  const bootWindow = window as BootWindow;
  if (bootWindow.__blairosBootSeen) {
    legacyRestoreOrLaunchSession();
    return;
  }
  bootWindow.__blairosBootSeen = true;
  const boot = el("div", "fixed inset-0 z-[9999] grid content-end gap-4 bg-[radial-gradient(circle_at_22%_18%,rgba(128,247,255,.16),transparent_28%),linear-gradient(180deg,rgba(3,5,10,.98),rgba(6,8,16,.94))] p-[clamp(22px,5vw,56px)] transition duration-500");
  const logo = el("h1", "m-0 font-mono text-[clamp(2.2rem,8vw,7rem)] font-black tracking-[-.08em]", { text: "BlairOS" });
  const log = el("div", "min-h-56 w-[min(760px,100%)] font-mono text-sm text-white/65 max-sm:min-h-72 max-sm:text-xs");
  const bar = el("div", "h-2 w-[min(680px,100%)] overflow-hidden rounded-full border border-white/15 bg-white/10");
  const fill = el("span", "block h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300 transition-all duration-200");
  bar.append(fill);
  append(boot, [logo, log, bar]);
  root.append(boot);

  const steps: BootStep[] = [
    { label: "kernel", detail: () => `root online at ${window.innerWidth}x${window.innerHeight}` },
    { label: "settings", detail: () => `dock ${settings.get().dockSize}, ${settings.get().clock24h ? "24h" : "12h"} clock, wallpaper sync` },
    { label: "filesystem", detail: () => `${desktopNodes().length} desktop nodes, /Applications, /bin, Trash mounted` },
    { label: "metadata", detail: "favorites, tags, comments, recents, and notifications loaded" },
    { label: "launcher", detail: () => `${searchableNodes().length} files plus ${appManifests.length} apps indexed` },
    { label: "windowserver", detail: "menu bar, desktop layer, dock, windows, and context menus attached" },
    { label: "input", detail: `global shortcuts active, keyboard mode ${keyboardMode}` },
    { label: "session", detail: "checking saved process table", action: restoreOrLaunchSession },
    { label: "ready", detail: () => `${processes.get().filter((item) => !item.minimized).length} windows visible` }
  ];
  steps.forEach((step, index) => {
    window.setTimeout(() => {
      const actionDetail = step.action?.();
      const detail = actionDetail || (typeof step.detail === "function" ? step.detail() : step.detail);
      append(log, [
        append(el("p", "mb-1 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 max-sm:grid-cols-[5.5rem_minmax(0,1fr)]", {}), [
          el("span", "text-cyan-200", { text: `[ok] ${step.label}` }),
          el("span", "truncate text-white/55", { text: detail })
        ])
      ]);
      fill.style.width = `${((index + 1) / steps.length) * 100}%`;
      if (index === steps.length - 1) {
        window.setTimeout(() => {
          boot.classList.add("opacity-0", "invisible", "pointer-events-none");
        }, 420);
      }
    }, 140 + index * 170);
  });
}

function makeMenuBar() {
  const menu = el("header", "fixed inset-x-0 top-0 z-[7000] grid h-[var(--menu-height)] grid-cols-[1fr_auto] items-center gap-3 border-b border-white/10 bg-slate-950/70 px-3 text-[0.82rem] backdrop-blur-2xl");
  const left = el("div", "flex min-w-0 items-center gap-1 overflow-hidden");
  let openDropdown: HTMLElement | null = null;
  let openDropdownAnchor: HTMLElement | null = null;
  let openDropdownKey: string | null = null;
  const menuButtonClass = "rounded-md px-2 py-1 font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/40";
  const mark = el("button", `${menuButtonClass} mr-1 font-black tracking-[-.04em] text-white`, { type: "button", text: "BlairOS" });
  activeApp = el("button", `${menuButtonClass} max-w-36 truncate font-bold text-white/85 max-sm:max-w-[7.5rem] max-sm:px-1.5`, { type: "button", text: "Finder" });
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
    openDropdownKey = null;
  }

  function showMenu(button: HTMLElement, items: MenuItem[], key = button.dataset.menuKey ?? button.textContent ?? button.title) {
    if (openDropdown) {
      const sameButton = openDropdownAnchor === button || openDropdownKey === key;
      closeMenu();
      if (sameButton) return;
    }
    closeNotificationCenter();
    closeContextMenu();
    const rect = button.getBoundingClientRect();
    openDropdown = el("div", "fixed z-[9200] grid min-w-56 gap-1 rounded-2xl border border-white/15 bg-slate-950/90 p-2 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-2xl max-sm:max-h-[calc(100dvh-var(--menu-height)-16px)] max-sm:w-[calc(100vw-16px)] max-sm:overflow-auto");
    openDropdownAnchor = button;
    openDropdownKey = key;
    openDropdown.style.left = isSmallScreen() ? "8px" : `${Math.max(8, Math.min(rect.left, window.innerWidth - 240))}px`;
    openDropdown.style.top = `${rect.bottom + 6}px`;
    items.forEach((item) => {
      if (!item.action) {
        openDropdown?.append(el("div", "px-3 pb-1 pt-2 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/35", { text: item.label }));
        return;
      }
      const row = el("button", "grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-3 py-2 text-left text-white/78 transition hover:bg-white/10 hover:text-white", { type: "button" });
      append(row, [el("span", "truncate", { text: item.label }), el("span", "font-mono text-xs text-white/35", { text: item.shortcut || "" })]);
      bindButtonAction(row, () => {
        item.action?.();
        closeMenu();
      });
      openDropdown?.append(row);
    });
    root.append(openDropdown);
  }

  function menuButton(label: string, items: MenuItem[]) {
    const button = el("button", `${menuButtonClass} max-sm:hidden`, { type: "button", text: label });
    button.dataset.menuKey = label;
    bindButtonAction(button, (event) => {
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

  function mobileMenuItems(): MenuItem[] {
    const process = focusedProcess();
    const appName = process ? appRegistry[process.appId].name : "Finder";
    return [
      { label: "File" },
      { label: `About ${appName}`, action: () => process?.appId === "about" ? notify("Already viewing About BlairOS") : launchApp("about") },
      { label: "New Window", action: () => process ? launchApp(process.appId, process.data ?? {}) : launchApp("files", { path: "/Home/blair" }) },
      { label: "Edit" },
      { label: "Copy", shortcut: "Cmd+C", action: () => notify("Copy") },
      { label: "Paste", shortcut: "Cmd+V", action: () => notify("Paste") },
      { label: "View" },
      { label: "Open Launcher", shortcut: "Cmd+K", action: openLauncher },
      { label: "Go" },
      { label: "Desktop", action: () => launchApp("files", { path: "/Desktop" }) },
      { label: "Applications", action: () => launchApp("files", { path: "/Applications" }) },
      { label: "Window" },
      { label: "Minimize", shortcut: "Cmd+M", action: () => { if (process) minimizeProcess(process.id); } },
      { label: "Restore Minimized", action: () => processes.get().filter((item) => item.minimized).forEach((item) => restoreProcess(item.id)) },
      { label: "Help" },
      { label: "Keyboard Shortcuts", action: () => notify("Cmd+K launcher, Cmd+Space terminal, window dots control close/min/max") }
    ];
  }

  function completeReset() {
    const overlay = el("div", "fixed inset-0 z-[9900] grid place-items-center bg-black/55 p-4 text-white backdrop-blur-md");
    const cancel = el("button", "rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/20", { type: "button", text: "Cancel" });
    const reset = el("button", "rounded-2xl bg-red-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-red-300", { type: "button", text: "Erase All Content and Settings" });
    const card = append(el("section", "w-[min(420px,calc(100vw-24px))] rounded-[30px] border border-red-300/25 bg-slate-950/95 p-5 shadow-2xl shadow-black/45"), [
      el("p", "font-mono text-xs uppercase tracking-[0.32em] text-red-200", { text: "system reset" }),
      el("h2", "mt-3 text-3xl font-black tracking-[-0.07em]", { text: "Erase All Content and Settings?" }),
      el("p", "mt-3 text-sm leading-6 text-white/65", { text: "This clears saved windows, files, settings, mail drafts, recents, and app state on this device." }),
      append(el("div", "mt-5 flex justify-end gap-2"), [cancel, reset])
    ]);
    const close = () => overlay.remove();
    bindButtonAction(cancel, close);
    bindButtonAction(reset, () => {
      localStorage.clear();
      window.location.reload();
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    append(overlay, [card]);
    root.append(overlay);
  }

  function showKeyboardShortcutsPanel() {
    const shortcuts = [
      ["Open Launcher", "Cmd+K"],
      ["Open Terminal", "Cmd+Space"],
      ["Open Settings", "Cmd+,"],
      ["Close Window", "Cmd+W"],
      ["Minimize Window", "Cmd+M"],
      ["Lock Screen", "Cmd+L"],
      ["Screenshot", "Cmd+P"],
      ["Cycle Windows", "Cmd+`"]
    ];
    const overlay = el("div", "fixed inset-0 z-[9900] grid place-items-center bg-black/45 p-4 text-white backdrop-blur-md");
    const close = el("button", "rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/20", { type: "button", text: "Close" });
    const rows = el("div", "mt-5 grid gap-2");
    shortcuts.forEach(([label, keys]) => {
      append(rows, [append(el("div", "grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/8 px-3 py-2"), [
        el("span", "text-sm text-white/75", { text: label }),
        el("kbd", "rounded-xl border border-cyan-200/25 bg-cyan-200/10 px-2 py-1 font-mono text-xs font-bold text-cyan-100", { text: keys })
      ])]);
    });
    const card = append(el("section", "w-[min(460px,calc(100vw-24px))] rounded-[30px] border border-cyan-200/20 bg-slate-950/95 p-5 shadow-2xl shadow-black/45"), [
      el("p", "font-mono text-xs uppercase tracking-[0.32em] text-cyan-200", { text: "keyboard" }),
      el("h2", "mt-3 text-3xl font-black tracking-[-0.07em]", { text: "Shortcuts" }),
      rows,
      append(el("div", "mt-5 flex justify-end"), [close])
    ]);
    const dismiss = () => overlay.remove();
    bindButtonAction(close, dismiss);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) dismiss();
    });
    append(overlay, [card]);
    root.append(overlay);
  }

  bindButtonAction(mark, (event) => {
    event.stopPropagation();
    const recentItems = getRecentItems().slice(0, 5).map((item) => ({ label: item.title, action: () => runRecent(item) }));
    showMenu(mark, [
      { label: "System" },
      { label: "About BlairOS", action: () => launchApp("about") },
      { label: "System Settings", shortcut: "Cmd+,", action: () => launchApp("settings") },
      { label: "Launcher", shortcut: "Cmd+K", action: openLauncher },
      { label: "Recent" },
      ...recentItems,
      { label: "Clear Recent Items", action: clearRecentItems },
      { label: "Sleep", action: () => notify("Display sleeping. Move pointer or press key to wake.") }
    ]);
  });

  bindButtonAction(activeApp, (event) => {
    event.stopPropagation();
    if (isSmallScreen()) {
      showMenu(activeApp, mobileMenuItems());
      return;
    }
    const process = focusedProcess();
    const appName = process ? appRegistry[process.appId].name : "Finder";
    showMenu(activeApp, process ? [
      { label: "App" },
      { label: `About ${appName}`, action: () => process.appId === "about" ? notify("Already viewing About BlairOS") : launchApp("about") },
      { label: `New ${appName} Window`, action: () => launchApp(process.appId, process.data ?? {}) },
      { label: "File" },
      ...fileItems(),
      { label: "Window" },
      { label: "Minimize", shortcut: "Cmd+M", action: () => minimizeProcess(process.id) },
      { label: process.maximized ? "Exit Full Window" : "Full Window", action: () => toggleMaximizeProcess(process.id) },
      { label: "Close Window", shortcut: "Cmd+W", action: () => closeProcess(process.id) }
    ] : [
      { label: "System" },
      { label: "About BlairOS", action: () => launchApp("about") },
      { label: "File" },
      ...fileItems(),
      { label: "Navigation" },
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
  bindButtonAction(search, openLauncher);
  const accessibility = append(el("button", "grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/8 text-white/75 transition hover:border-white/20 hover:bg-white/15", { type: "button", title: "Accessibility Keyboard" }), [icon("ph-keyboard", "text-base")]);
  bindButtonAction(accessibility, (event) => {
    event.stopPropagation();
    showMenu(accessibility, [
      { label: "Keyboard" },
      { label: keyboardMode === "os" ? "Use Browser Native Keyboard" : "Use BlairOS Keyboard", action: toggleKeyboardMode },
      { label: osKeyboardPinned ? "Hide Accessibility Keyboard" : "Show Accessibility Keyboard", action: toggleOsKeyboardPinned },
      { label: "Shortcuts" },
      { label: "Keyboard Shortcuts", action: showKeyboardShortcutsPanel },
      { label: "Open Settings", action: () => launchApp("settings") }
    ]);
  });
  const user = append(el("button", "flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/15 max-sm:grid max-sm:place-items-center", { type: "button", title: "blair" }), [icon("ph-user-circle", "text-base"), el("span", "max-sm:hidden", { text: "blair" })]);
  bindButtonAction(user, (event) => {
    event.stopPropagation();
    showMenu(user, [
      { label: "Account" },
      { label: "Open Profile", action: () => launchApp("about") },
      { label: "Home Folder", action: () => launchApp("files", { path: "/Home/blair" }) },
      { label: "System" },
      { label: "System Settings", shortcut: "Cmd+,", action: () => launchApp("settings") },
      { label: "Start Screensaver", action: () => startScreensaver() },
      { label: "Lock Screen", action: showLockScreen },
      { label: "Erase All Content and Settings", action: completeReset }
    ]);
  });
  const wifi = append(el("button", "flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-xs font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/15 max-sm:grid max-sm:place-items-center", { type: "button", title: "Connected to BlairFi" }), [icon("ph-wifi-high", "text-base text-cyan-100"), el("span", "max-sm:hidden", { text: "BlairFi" })]);
  bindButtonAction(wifi, (event) => {
    event.stopPropagation();
    showMenu(wifi, [
      { label: "Connected to BlairFi", action: () => notify("Connected to BlairFi") },
      { label: "Available Network" },
      { label: "The Promised LAN", action: () => notify("The Promised LAN is out of range") },
      { label: "Pretty Fly for a Wi-Fi", action: () => notify("Pretty Fly for a Wi-Fi declined politely") },
      { label: "Open Network Utility", action: () => launchApp("networkUtility") },
      { label: "Run Diagnostics", action: () => runJob("Network diagnostics", "networkd", "checking signal and DNS", () => launchApp("networkUtility", { tool: "ping" })) },
      { label: "Reconnect Wi-Fi", action: () => runJob("Wi-Fi reconnect", "airportd", "renewing link", () => notify("Connected to BlairFi")) }
    ]);
  });
  const battery = append(el("button", "flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1 font-mono text-xs text-white/75 transition hover:border-white/20 hover:bg-white/15 max-sm:justify-center", { type: "button", title: "Battery 92%" }), [icon("ph-battery-full", "text-base text-emerald-200"), el("span", "max-sm:hidden", { text: "92%" })]);
  bindButtonAction(battery, (event) => {
    event.stopPropagation();
    showMenu(battery, [
      { label: "Power" },
      { label: "Battery: 92%", action: () => notify("Battery 92%, healthy") },
      { label: "Utilities" },
      { label: "Open System Profiler", action: () => launchApp("systemProfiler") },
      { label: "Open Activity Monitor", action: () => launchApp("activityMonitor") },
      { label: "Low Power Mode", action: () => notify("Low Power Mode scheduled for later") }
    ]);
  });
  const clock = el("button", "rounded-md px-2 py-1 font-mono transition hover:bg-white/10 max-sm:text-xs", { type: "button" });
  bindButtonAction(clock, (event) => {
    event.stopPropagation();
    if (notificationPanel) {
      closeNotificationCenter();
      return;
    }
    closeMenu();
    closeContextMenu();
    showNotificationCenter(clock);
  });
  const tick = () => (clock.textContent = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", ...(isSmallScreen() ? {} : { weekday: "short" }), hour12: !settings.get().clock24h }).format(new Date()));
  settings.subscribe(tick);
  tick();
  window.setInterval(tick, 15000);
  window.addEventListener("resize", tick, { passive: true });
  append(right, [search, accessibility, user, wifi, battery, clock]);
  append(menu, [left, right]);
  root.append(menu);
}

function makeDesktop() {
  const desktop = el("main", "fixed inset-x-0 bottom-[var(--dock-height)] top-[var(--menu-height)] overflow-auto p-5 max-sm:p-3");
  const grid = el("div", "grid max-h-full w-max auto-cols-[92px] grid-flow-col grid-rows-6 gap-3 max-sm:w-full max-sm:grid-flow-row max-sm:grid-cols-3 max-sm:grid-rows-none max-sm:gap-2");
  desktopNodes().forEach((node) => {
    const item = el("button", "grid min-h-[90px] w-[92px] content-start justify-items-center gap-2 rounded-2xl border border-transparent px-1.5 py-2.5 text-center text-xs leading-4 transition hover:border-white/15 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 max-sm:min-h-20 max-sm:w-auto max-sm:px-1 max-sm:py-2", { type: "button" });
    item.dataset.fsPath = node.path;
    append(item, [icon(node.icon, "text-4xl text-cyan-100 drop-shadow"), el("span", "max-w-full break-words [text-shadow:0_1px_8px_rgba(0,0,0,.8)]", { text: node.name })]);
    bindFsDrag(item, node);
    item.addEventListener("dblclick", () => openNode(node));
    bindButtonAction(item, () => isSmallScreen() ? openNode(node) : notify(`${node.name} selected. Double-click to open.`));
    grid.append(item);
  });
  desktop.append(grid);
  root.append(desktop);
}

function makeDock() {
  dock = el("nav", "fixed bottom-[max(8px,env(safe-area-inset-bottom))] left-1/2 z-[7500] flex max-w-[calc(100vw-22px)] -translate-x-1/2 items-end gap-2 rounded-[26px] border border-white/15 bg-slate-950/55 p-2.5 shadow-2xl shadow-black/40 backdrop-blur-2xl max-sm:w-[calc(100vw-16px)] max-sm:justify-start max-sm:overflow-x-auto max-sm:p-2");
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
    bindButtonAction(item, () => {
      const appProcesses = processes.get().filter((process) => process.appId === app.id).sort((a, b) => b.z - a.z);
      const existing = appProcesses.find((process) => process.minimized) ?? appProcesses[0];
      existing ? restoreProcess(existing.id) : launchApp(app.id);
    });
    dock.append(item);
  });
}

function osKeyData(key: string) {
  if (key === "Back") return "\u007f";
  if (key === "Enter") return "\r";
  if (key === "Space") return " ";
  if (key === "Tab") return "\t";
  if (key === "←") return "\x1b[D";
  if (key === "↓") return "\x1b[B";
  if (key === "↑") return "\x1b[A";
  if (key === "→") return "\x1b[C";
  if (key === "Ctrl+X") return "\x18";
  if (key === "Ctrl+O") return "\x0f";
  if (key === "Ctrl+K") return "\x0b";
  return osKeyboardShifted ? shiftedOsKey(key) : key;
}

function shiftedOsKey(key: string) {
  const shifted: Record<string, string> = {
    "1": "!",
    "2": "@",
    "3": "#",
    "4": "$",
    "5": "%",
    "6": "^",
    "7": "&",
    "8": "*",
    "9": "(",
    "0": ")",
    "/": "?",
    ".": ">",
    "-": "_",
    "_": "-",
    "|": "\\",
    "~": "`"
  };
  if (/^[a-z]$/.test(key)) return key.toUpperCase();
  return shifted[key] ?? key;
}

function clearShiftAfterKey(key: string) {
  return /^[a-z0-9]$/.test(key) || ["/", ".", "-", "_", "|", "~"].includes(key);
}

function osKeyIcon(key: string) {
  const icons: Record<string, string> = {
    Shift: "ph-arrow-fat-up",
    Back: "ph-backspace",
    Enter: "ph-arrow-bend-down-left",
    Space: "ph-keyboard",
    Tab: "ph-arrow-line-right",
    "←": "ph-arrow-left",
    "↓": "ph-arrow-down",
    "↑": "ph-arrow-up",
    "→": "ph-arrow-right",
    "Ctrl+X": "ph-scissors",
    "Ctrl+O": "ph-floppy-disk",
    "Ctrl+K": "ph-command"
  };
  return icons[key];
}

function sendOsKey(key: string) {
  if (launcher && !launcher.classList.contains("hidden") && isEditableElement(launcherInput)) {
    launcherInput.focus({ preventScroll: true });
    applyOsKeyToEditable(launcherInput, key, osKeyData(key));
    return;
  }
  const process = focusedProcess();
  if (!process) return;
  const data = osKeyData(key);
  if (process.appId === "terminal") {
    window.dispatchEvent(new CustomEvent("blairos:os-key", { detail: { processId: process.id, data } }));
    return;
  }
  const target = editableTarget(process);
  if (!target) return;
  target.focus({ preventScroll: true });
  applyOsKeyToEditable(target, key, data);
}

function processWindow(process: ProcessRecord) {
  return windowLayer?.querySelector<HTMLElement>(`[data-process="${process.id}"]`) ?? null;
}

function editableSelector() {
  return "input:not([type=button]):not([type=submit]):not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable='true']";
}

function isEditableElement(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement | HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (!element.matches(editableSelector())) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  return true;
}

function editableTarget(process: ProcessRecord) {
  const win = processWindow(process);
  if (!win) return null;
  if (isEditableElement(document.activeElement) && win.contains(document.activeElement)) return document.activeElement;
  return null;
}

function hasFocusedEditable(process: ProcessRecord) {
  const win = processWindow(process);
  return Boolean(win && isEditableElement(document.activeElement) && win.contains(document.activeElement));
}

function animateWindowAction(win: HTMLElement, frames: Keyframe[], done: () => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return;
  }
  if (isSmallScreen()) {
    const from = frames[0] as Record<string, string | number>;
    const to = frames[frames.length - 1] as Record<string, string | number>;
    win.getAnimations().forEach((animation) => animation.cancel());
    win.dataset.windowAnimating = "true";
    win.style.transition = "none";
    win.style.willChange = "transform, opacity, filter";
    if (from.opacity !== undefined) win.style.opacity = String(from.opacity);
    if (from.transform !== undefined) win.style.transform = String(from.transform);
    if (from.filter !== undefined) win.style.filter = String(from.filter);
    requestAnimationFrame(() => {
      win.style.transition = "transform 180ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease, filter 160ms ease";
      if (to.opacity !== undefined) win.style.opacity = String(to.opacity);
      if (to.transform !== undefined) win.style.transform = String(to.transform);
      if (to.filter !== undefined) win.style.filter = String(to.filter);
      window.setTimeout(() => {
        win.style.willChange = "";
        delete win.dataset.windowAnimating;
        done();
      }, 190);
    });
    return;
  }
  void win.animate(frames, { duration: 150, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }).finished.finally(done);
}

function animateMaximizeTap(win: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (isSmallScreen()) {
    win.getAnimations().forEach((animation) => animation.cancel());
    win.dataset.windowAnimating = "true";
    win.style.transition = "none";
    win.style.willChange = "transform, filter";
    win.style.transform = "scale(1)";
    win.style.filter = "brightness(1)";
    requestAnimationFrame(() => {
      win.style.transition = "transform 160ms cubic-bezier(.2,.8,.2,1), filter 160ms ease";
      win.style.transform = "scale(.965)";
      win.style.filter = "brightness(1.16)";
      window.setTimeout(() => {
        win.style.transform = "scale(1)";
        win.style.filter = "brightness(1)";
        window.setTimeout(() => {
          win.style.willChange = "";
          delete win.dataset.windowAnimating;
        }, 170);
      }, 90);
    });
    return;
  }
  win.animate([{ transform: "scale(1)" }, { transform: "scale(.985)" }, { transform: "scale(1)" }], { duration: 140, easing: "cubic-bezier(.2,.8,.2,1)" });
}

function setNativeKeyboardMode(win: HTMLElement, enabled: boolean) {
  win.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((field) => {
    if (enabled) field.inputMode = "none";
    else field.removeAttribute("inputmode");
  });
}

function keyName(key: string, data: string) {
  if (key === "Back") return "Backspace";
  if (key === "Space") return " ";
  if (key === "←") return "ArrowLeft";
  if (key === "↓") return "ArrowDown";
  if (key === "↑") return "ArrowUp";
  if (key === "→") return "ArrowRight";
  if (key === "Ctrl+X") return "x";
  if (key === "Ctrl+O") return "o";
  if (key === "Ctrl+K") return "k";
  return key === "Enter" || key === "Tab" ? key : data;
}

function applyOsKeyToEditable(target: HTMLInputElement | HTMLTextAreaElement | HTMLElement, key: string, data: string) {
  const event = new KeyboardEvent("keydown", { key: keyName(key, data), bubbles: true, cancelable: true, ctrlKey: key.startsWith("Ctrl+") });
  const handled = !target.dispatchEvent(event);
  if (handled) return;
  if (key === "Tab") {
    focusNextEditable(target);
    return;
  }
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  if (key === "←" || key === "→") {
    const pos = target.selectionStart ?? target.value.length;
    const next = Math.max(0, Math.min(target.value.length, pos + (key === "←" ? -1 : 1)));
    target.selectionStart = target.selectionEnd = next;
    return;
  }
  if (key === "↑" || key === "↓") return;
  if (key === "Enter" && target instanceof HTMLInputElement) return;
  if (key.startsWith("Ctrl+")) return;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  const insert = key === "Back" ? "" : key === "Enter" ? "\n" : data;
  const before = key === "Back" && start === end ? Math.max(0, start - 1) : start;
  target.value = `${target.value.slice(0, before)}${insert}${target.value.slice(end)}`;
  const next = before + insert.length;
  target.selectionStart = target.selectionEnd = next;
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: key === "Back" ? "deleteContentBackward" : "insertText", data: insert }));
}

function focusNextEditable(target: HTMLElement) {
  const process = focusedProcess();
  if (!process) return;
  const win = processWindow(process);
  if (!win) return;
  const items = [...win.querySelectorAll<HTMLElement>(editableSelector())].filter(isEditableElement);
  if (!items.length) return;
  const index = Math.max(0, items.indexOf(target));
  items[(index + 1) % items.length].focus({ preventScroll: true });
}

function renderOsKeyboard() {
  osKeyboard.replaceChildren();
  const rows = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["Shift", "z", "x", "c", "v", "b", "n", "m", "Back"],
    ["Tab", "←", "↓", "↑", "→", "Space", "Enter"],
    ["Ctrl+X", "Ctrl+O", "Ctrl+K", "/", ".", "-", "_", "|", "~"]
  ];
  rows.forEach((keys) => {
    const row = el("div", "grid w-full gap-1");
    row.style.gridTemplateColumns = keys.map((key) => key === "Space" ? "2fr" : ["Shift", "Back", "Enter", "Ctrl+X", "Ctrl+O", "Ctrl+K"].includes(key) ? "1.35fr" : "1fr").join(" ");
    keys.forEach((key) => {
      const keyIcon = osKeyIcon(key);
      const button = el("button", "grid min-h-10 min-w-0 place-items-center truncate rounded-xl border border-white/10 bg-white/10 px-1 text-center text-[0.68rem] font-bold text-white/80 active:bg-cyan-200/25", { type: "button", title: key, "aria-label": key });
      if (keyIcon) button.append(icon(keyIcon, `${key === "Shift" && osKeyboardShifted ? "text-cyan-200" : "text-white/80"} text-lg`));
      else button.textContent = osKeyboardShifted ? shiftedOsKey(key) : key;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (key === "Shift") {
          osKeyboardShifted = !osKeyboardShifted;
          renderOsKeyboard();
          return;
        }
        sendOsKey(key);
        if (osKeyboardShifted && clearShiftAfterKey(key)) {
          osKeyboardShifted = false;
          renderOsKeyboard();
        }
      });
      row.append(button);
    });
    osKeyboard.append(row);
  });
}

function syncOsKeyboard() {
  if (!osKeyboard) return;
  const process = focusedProcess();
  const launcherFocused = Boolean(launcher && !launcher.classList.contains("hidden") && document.activeElement === launcherInput);
  const appNeedsKeyboard = Boolean(process && !process.minimized && (process.appId === "terminal" || hasFocusedEditable(process)));
  const useOsKeyboard = keyboardMode === "os";
  const visible = useOsKeyboard && (osKeyboardPinned || Boolean(isSmallScreen() && (launcherFocused || appNeedsKeyboard)));
  osKeyboard.hidden = !visible;
  windowLayer?.querySelectorAll<HTMLElement>("[data-process]").forEach((node) => setNativeKeyboardMode(node, visible && isSmallScreen()));
  if (launcherInput) {
    if (visible && isSmallScreen()) launcherInput.inputMode = "none";
    else launcherInput.removeAttribute("inputmode");
  }
  if (dock) dock.style.display = visible ? "none" : "";
  if (!windowLayer) return;
  const setBottomHeight = () => {
    const value = visible ? `${Math.max(172, osKeyboard.getBoundingClientRect().height)}px` : "var(--dock-height)";
    root.style.setProperty("--mobile-bottom-height", value);
  };
  setBottomHeight();
  if (visible) requestAnimationFrame(setBottomHeight);
}

function toggleOsKeyboardPinned() {
  if (!osKeyboardPinned && keyboardMode !== "os") {
    keyboardMode = "os";
    localStorage.setItem("blairos.keyboardMode", keyboardMode);
  }
  osKeyboardPinned = !osKeyboardPinned;
  syncOsKeyboard();
  notify(osKeyboardPinned ? "Accessibility Keyboard shown" : "Accessibility Keyboard hidden");
}

function toggleKeyboardMode() {
  keyboardMode = keyboardMode === "os" ? "native" : "os";
  if (keyboardMode === "native") osKeyboardPinned = false;
  localStorage.setItem("blairos.keyboardMode", keyboardMode);
  syncOsKeyboard();
  notify(keyboardMode === "os" ? "BlairOS Keyboard enabled" : "Browser native keyboard enabled");
}

function makeOsKeyboard() {
  osKeyboard = el("div", "fixed inset-x-0 bottom-0 z-[8800] grid max-h-[42dvh] gap-1 overflow-auto border-t border-cyan-200/15 bg-slate-950/95 p-2 font-mono shadow-[0_-18px_40px_rgba(0,0,0,.35)]");
  osKeyboard.hidden = true;
  renderOsKeyboard();
  root.append(osKeyboard);
  window.addEventListener("resize", syncOsKeyboard, { passive: true });
  document.addEventListener("focusin", () => requestAnimationFrame(syncOsKeyboard));
  document.addEventListener("focusout", () => requestAnimationFrame(syncOsKeyboard));
  windowLayer.addEventListener("focusin", syncOsKeyboard);
  windowLayer.addEventListener("focusout", () => requestAnimationFrame(syncOsKeyboard));
  windowLayer.addEventListener("pointerdown", (event) => {
    if (isEditableElement(event.target instanceof Element ? event.target : null)) return;
    if (isEditableElement(document.activeElement)) document.activeElement.blur();
    requestAnimationFrame(syncOsKeyboard);
  }, true);
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
    if (/open old|old homepage/.test(q)) actions.push({ id: "action:old-home", title: "Open old homepage", subtitle: "blairos://Desktop/old-homepage.html", icon: "ph-file-html", kind: "action", action: () => launchApp("browser", { url: "blairos://Desktop/old-homepage.html" }) });
  if (/find projects|projects/.test(q)) actions.push({ id: "action:projects", title: "Find projects", subtitle: "/Projects", icon: "ph-folder", kind: "action", action: () => launchApp("files", { path: "/Projects" }) });
  if (/email|mail blair|contact/.test(q)) actions.push({ id: "action:email", title: "Email Blair", subtitle: "Open Mail", icon: "ph-envelope-simple", kind: "action", action: () => launchApp("mail") });
  if (/git|repo|commit/.test(q)) actions.push({ id: "action:git", title: "Open Git", subtitle: "Repos and commits", icon: "ph-git-branch", kind: "action", action: () => launchApp("git") });
  return actions;
}

function makeLauncher() {
  launcher = el("div", "fixed inset-x-0 bottom-[var(--mobile-bottom-height)] top-[var(--menu-height)] z-[6900] hidden place-items-start justify-center bg-black/25 pt-[8vh] backdrop-blur-sm max-sm:pt-2");
  const panel = el("div", `${glass} w-[min(720px,calc(100vw-26px))] overflow-hidden rounded-[28px] max-sm:h-[calc(100dvh-var(--menu-height)-var(--mobile-bottom-height)-16px)] max-sm:w-[calc(100vw-16px)] max-sm:rounded-[22px]`);
  launcherInput = el("input", "w-full border-0 border-b border-white/15 bg-transparent px-5 py-5 text-lg text-white outline-none placeholder:text-white/35 max-sm:px-4 max-sm:py-4", { placeholder: "Search apps, files, links, /bin..." }) as HTMLInputElement;
  launcherResults = el("div", "grid max-h-[min(520px,58vh)] gap-1 overflow-auto p-2 max-sm:max-h-[calc(100dvh-var(--menu-height)-110px)]");
  append(panel, [launcherInput, launcherResults]);
  launcher.append(panel);
  launcher.addEventListener("click", (event) => {
    if (event.target === launcher) closeLauncher();
  });
  launcherInput.addEventListener("input", renderLauncherResults);
  launcherInput.addEventListener("focus", syncOsKeyboard);
  launcherInput.addEventListener("blur", () => requestAnimationFrame(syncOsKeyboard));
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
  if (isSmallScreen() && keyboardMode === "os") launcherInput.inputMode = "none";
  launcherInput.focus({ preventScroll: true });
  syncOsKeyboard();
  requestAnimationFrame(syncOsKeyboard);
}

function closeLauncher() {
  launcher.classList.add("hidden");
  launcher.classList.remove("grid");
  launcherInput.blur();
  requestAnimationFrame(syncOsKeyboard);
}

function renderLauncherResults() {
  const items = searchItems();
  const query = launcherInput.value.trim();
  const results = query ? [...naturalActions(query), ...new Fuse(items, { keys: ["title", "subtitle", "kind"], threshold: 0.34 }).search(query).map((result) => result.item)] : items.slice(0, 12);
  launcherResults.replaceChildren();
  results.slice(0, 18).forEach((item) => {
    const row = el("button", "grid grid-cols-[46px_1fr_auto] items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 max-sm:grid-cols-[40px_1fr] max-sm:py-3", { type: "button" });
    append(row, [icon(item.icon, "text-3xl text-cyan-100"), append(el("span", "min-w-0"), [el("span", "block truncate font-semibold", { text: item.title }), el("span", "block truncate text-xs text-white/45", { text: item.subtitle })]), el("span", "font-mono text-xs uppercase text-white/40 max-sm:hidden", { text: item.kind })]);
    bindButtonAction(row, () => {
      item.action();
      closeLauncher();
    });
    launcherResults.append(row);
  });
}

function makeWindowLayer() {
  windowLayer = el("section", "pointer-events-none fixed inset-x-0 bottom-0 top-[var(--menu-height)] max-sm:grid max-sm:items-stretch max-sm:overflow-hidden max-sm:p-1.5");
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
  const win = el("article", `${glass} blairos-window pointer-events-auto absolute grid min-h-60 min-w-80 grid-rows-[42px_1fr] overflow-hidden rounded-[22px] max-sm:!min-w-0 max-sm:rounded-[18px]`);
  win.dataset.process = process.id;
  const titlebar = el("header", "window-drag grid cursor-grab touch-none select-none grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/15 bg-white/5 px-3");
  titlebar.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    toggleMaximizeProcess(process.id);
  });
  const controls = el("div", "relative z-10 flex gap-2");
  const controlClass = "h-3.5 w-3.5 rounded-full border border-black/20 transition hover:scale-125 hover:brightness-125 hover:ring-2 hover:ring-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-200/70 max-sm:hover:scale-100";
  const close = el("button", `${controlClass} bg-[#ff5f57] hover:shadow-[0_0_12px_rgba(255,95,87,.7)]`, { type: "button", title: "close" });
  const min = el("button", `${controlClass} bg-[#ffbd2e] hover:shadow-[0_0_12px_rgba(255,189,46,.7)]`, { type: "button", title: "minimize to Dock" });
  const max = el("button", `${controlClass} bg-[#28c840] hover:shadow-[0_0_12px_rgba(40,200,64,.7)]`, { type: "button", title: "maximize" });
  [close, min, max].forEach((control) => {
    control.addEventListener("pointerdown", (event) => event.stopPropagation());
  });
  bindButtonAction(close, (event) => {
    event.stopPropagation();
    animateWindowAction(win, [{ opacity: 1 }, { opacity: 0, transform: "scale(.96) translateY(-8px)", filter: "blur(3px)" }], () => closeProcess(process.id));
  });
  bindButtonAction(min, (event) => {
    event.stopPropagation();
    animateWindowAction(win, [{ opacity: 1 }, { opacity: 0, transform: "translateY(22px) scale(.95)", filter: "blur(2px)" }], () => minimizeProcess(process.id));
  });
  bindButtonAction(max, (event) => {
    event.stopPropagation();
    animateMaximizeTap(win);
    toggleMaximizeProcess(process.id);
  });
  append(controls, [close, min, max]);
  const titleLabel = append(el("div", "truncate text-sm font-bold text-white/75", { "data-window-title": "true" }), [icon(process.icon, "mr-2 inline text-lg text-cyan-200"), process.title]);
  append(titlebar, [controls, titleLabel, el("span", "w-3", { "aria-hidden": "true" })]);
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
  if (!process.minimized && !win.dataset.windowAnimating) {
    win.getAnimations().forEach((animation) => animation.cancel());
    win.style.transition = "";
    win.style.willChange = "";
    win.style.opacity = "";
    win.style.filter = "";
    if (process.maximized) {
      delete win.dataset.mobileDragX;
      delete win.dataset.mobileDragY;
      win.style.transform = "";
    } else {
      win.style.transform = isSmallScreen() && win.dataset.mobileDragX && win.dataset.mobileDragY
        ? `translate(${win.dataset.mobileDragX}px, ${win.dataset.mobileDragY}px)`
        : "";
    }
  }
  win.classList.toggle("hidden", process.minimized);
  win.classList.toggle("ring-1", isFocused);
  win.classList.toggle("ring-cyan-200/35", isFocused);
  win.querySelector<HTMLElement>("[data-focus-shield]")?.classList.toggle("hidden", isFocused);
  const titleLabel = win.querySelector<HTMLElement>("[data-window-title]");
  if (titleLabel) titleLabel.replaceChildren(icon(process.icon, "mr-2 inline text-lg text-cyan-200"), process.title);
  win.style.zIndex = String(process.z);
  if (process.maximized) {
    win.style.borderRadius = "0";
    win.style.left = "0";
    win.style.top = "0";
    win.style.width = "100%";
    win.style.height = "calc(100% - var(--mobile-bottom-height))";
  } else {
    win.style.borderRadius = "";
    win.style.left = `${process.x}px`;
    win.style.top = `${process.y}px`;
    win.style.width = `${process.width}px`;
    win.style.height = `${process.height}px`;
  }
}

function attachInteract(win: HTMLElement, processId: string) {
  const interaction = interact(win)
    .draggable({
      allowFrom: ".window-drag",
      ignoreFrom: "button,input",
      listeners: {
        move(event) {
          const process = processes.get().find((item) => item.id === processId);
          if (!process) return;
          if (process.maximized) {
            delete win.dataset.mobileDragX;
            delete win.dataset.mobileDragY;
            win.style.transform = "";
            const nextWidth = Math.min(process.width, Math.max(320, window.innerWidth - 96));
            const grabRatio = Math.max(0.15, Math.min(0.85, event.clientX / Math.max(1, window.innerWidth)));
            updateProcess(processId, {
              maximized: false,
              width: nextWidth,
              height: Math.min(process.height, Math.max(240, window.innerHeight - 120)),
              x: Math.round(event.clientX - nextWidth * grabRatio),
              y: Math.max(8, Math.round(event.clientY - 22))
            });
            return;
          }
          if (isSmallScreen()) {
            const x = Number(win.dataset.mobileDragX ?? 0) + event.dx;
            const y = Number(win.dataset.mobileDragY ?? 0) + event.dy;
            win.dataset.mobileDragX = String(x);
            win.dataset.mobileDragY = String(y);
            win.style.transform = `translate(${x}px, ${y}px)`;
            return;
          }
          updateProcess(processId, { x: process.x + event.dx, y: process.y + event.dy });
        }
      }
    });

  if (isSmallScreen()) return;

  interaction.resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 320, height: 240 } })],
      listeners: {
        move(event) {
          const process = processes.get().find((item) => item.id === processId);
          if (!process || process.maximized || isSmallScreen()) return;
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
makeOsKeyboard();
makeLauncher();
bindKeys();
bindEasterEggs();
bindContextMenus();
bindIdleScreensaver();
processes.subscribe(renderWindows);
focusedProcessId.subscribe(renderWindows);
processes.subscribe(syncOsKeyboard);
focusedProcessId.subscribe(syncOsKeyboard);
makeBoot();
