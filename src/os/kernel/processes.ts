import { atom } from "nanostores";
import { nanoid } from "nanoid";
import { appRegistry } from "./apps";
import { addRecentItem } from "./recent";
import type { AppId, ProcessRecord } from "./types";

export const processes = atom<ProcessRecord[]>([]);
export const focusedProcessId = atom<string | null>(null);

let zCounter = 20;
let launchOffset = 0;
const SESSION_KEY = "blairos.windows.v1";

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(processes.get()));
  } catch {
    // Session restore is best-effort.
  }
}

export function restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "[]") as ProcessRecord[];
    const valid = saved.filter((process) => appRegistry[process.appId]);
    if (!valid.length) return false;
    zCounter = Math.max(zCounter, ...valid.map((process) => process.z));
    processes.set(valid);
    focusedProcessId.set(valid.filter((process) => !process.minimized).sort((a, b) => b.z - a.z)[0]?.id ?? null);
    return true;
  } catch {
    return false;
  }
}

export function launchApp(appId: AppId, data: Record<string, unknown> = {}) {
  const app = appRegistry[appId];
  if (!app) return;
  addRecentItem({ id: `app:${appId}`, title: app.name, subtitle: "Application", icon: app.icon, kind: "app", appId });

  const existing = processes.get().find((process) => process.appId === appId && process.minimized);
  if (existing) {
    restoreProcess(existing.id);
    return;
  }

  const id = nanoid(8);
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const width = mobile ? Math.max(320, window.innerWidth - 12) : Math.min(app.defaultSize.width, window.innerWidth - 32);
  const height = mobile ? Math.max(420, window.innerHeight - 128) : Math.min(app.defaultSize.height, window.innerHeight - 120);
  const process: ProcessRecord = {
    id,
    appId,
    title: app.name,
    icon: app.icon,
    x: mobile ? 6 : 80 + launchOffset,
    y: mobile ? 6 : 64 + launchOffset,
    width,
    height,
    z: ++zCounter,
    minimized: false,
    maximized: false,
    data
  };

  launchOffset = mobile ? 0 : (launchOffset + 28) % 160;
  processes.set([...processes.get(), process]);
  focusedProcessId.set(id);
  saveSession();
}

export function closeProcess(id: string) {
  const next = processes.get().filter((process) => process.id !== id);
  processes.set(next);
  if (focusedProcessId.get() === id) {
    focusedProcessId.set(next.at(-1)?.id ?? null);
  }
  saveSession();
}

export function focusProcess(id: string) {
  focusedProcessId.set(id);
  updateProcess(id, { z: ++zCounter, minimized: false });
}

export function minimizeProcess(id: string) {
  updateProcess(id, { minimized: true });
  const visible = processes.get().filter((process) => process.id !== id && !process.minimized);
  focusedProcessId.set(visible.sort((a, b) => b.z - a.z)[0]?.id ?? null);
}

export function restoreProcess(id: string) {
  focusProcess(id);
  updateProcess(id, { minimized: false });
}

export function toggleMaximizeProcess(id: string) {
  const process = processes.get().find((item) => item.id === id);
  if (!process) return;
  updateProcess(id, { maximized: !process.maximized });
  focusProcess(id);
}

export function updateProcess(id: string, patch: Partial<ProcessRecord>) {
  processes.set(processes.get().map((process) => (process.id === id ? { ...process, ...patch } : process)));
  saveSession();
}
