import { atom } from "nanostores";

export type OsSettings = {
  theme: "night" | "dawn" | "forest";
  density: "roomy" | "compact";
  dockSize: "compact" | "standard" | "large";
  showGrid: boolean;
  clock24h: boolean;
  reduceMotion: boolean;
};

const defaults: OsSettings = {
  theme: "night",
  density: "roomy",
  dockSize: "standard",
  showGrid: true,
  clock24h: true,
  reduceMotion: false
};

function readSettings(): OsSettings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("blairos:settings") || "{}") };
  } catch {
    return defaults;
  }
}

export const settings = atom<OsSettings>(typeof window === "undefined" ? defaults : readSettings());

export function updateSettings(next: Partial<OsSettings>) {
  settings.set({ ...settings.get(), ...next });
}

export function bindSettings() {
  settings.subscribe((value) => {
    document.documentElement.dataset.theme = value.theme === "night" ? "" : value.theme;
    document.documentElement.dataset.density = value.density;
    document.documentElement.dataset.dockSize = value.dockSize;
    document.documentElement.style.setProperty("--dock-height", value.dockSize === "compact" ? "68px" : value.dockSize === "large" ? "96px" : "84px");
    document.documentElement.style.setProperty("--desktop-grid-opacity", value.showGrid ? "1" : "0");
    document.documentElement.classList.toggle("reduce-motion", value.reduceMotion);
    localStorage.setItem("blairos:settings", JSON.stringify(value));
  });
}
