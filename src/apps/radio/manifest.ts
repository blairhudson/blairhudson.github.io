import { append, button, el } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

type Station = {
  name: string;
  band: string;
  mood: string;
  track: string;
  signal: number;
};

const RADIO_KEY = "blairos.radio.v1";

const stations: Station[] = [
  { name: "Night Build FM", band: "88.5", mood: "late coding / synth wash", track: "Refactor Under Blue Light", signal: 94 },
  { name: "Kernel Jazz", band: "91.7", mood: "soft drums / terminal rain", track: "Semaphore Waltz", signal: 87 },
  { name: "Sublight AM", band: "1040", mood: "essay drafts / city static", track: "Operating System Returns", signal: 72 },
  { name: "Packet Radio", band: "145.8", mood: "network pings / orbital hum", track: "TTL 54", signal: 81 }
];

function readState() {
  try {
    return JSON.parse(localStorage.getItem(RADIO_KEY) ?? "{}") as { station?: string; volume?: number; favourites?: string[]; history?: string[] };
  } catch {
    return {};
  }
}

function writeState(state: { station?: string; volume?: number; favourites?: string[]; history?: string[] }) {
  localStorage.setItem(RADIO_KEY, JSON.stringify(state));
}

export const radioManifest: AppManifest = {
  id: "radio",
  name: "Radio",
  icon: "ph-radio",
  defaultSize: { width: 720, height: 520 },
  render: () => {
    const saved = readState();
    let current = stations.find((station) => station.name === saved.station) ?? stations[0];
    let playing = true;
    let progress = 18;
    let volume = saved.volume ?? 72;
    let favourites = new Set(saved.favourites ?? []);
    let history = saved.history ?? [];
    const root = el("section", "grid h-full grid-rows-[1fr_auto] gap-4 p-5 text-white");
    const deck = el("div", "grid gap-4 rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_30%_0%,rgba(103,232,249,.18),transparent_34%),rgba(0,0,0,.28)] p-6 shadow-2xl lg:grid-cols-[1fr_220px]");
    const now = el("div", "grid content-center gap-4 text-center lg:text-left");
    const meterFill = el("span", "block h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300");
    const progressFill = el("span", "block h-full rounded-full bg-cyan-300");
    const stationList = el("div", "grid content-start gap-2");
    const footer = el("div", "grid gap-3 rounded-3xl border border-white/10 bg-black/25 p-4 sm:grid-cols-[1fr_auto]");
    const recent = el("div", "min-w-0 text-sm text-white/55");
    const volumeLabel = el("span", "font-mono text-xs text-cyan-100", { text: `${volume}%` });

    function persist() {
      writeState({ station: current.name, volume, favourites: [...favourites], history });
    }

    function tune(station: Station) {
      current = station;
      playing = true;
      progress = 0;
      history = [`${station.name} • ${station.track}`, ...history.filter((item) => !item.startsWith(`${station.name} •`))].slice(0, 6);
      persist();
      render();
    }

    function render() {
      now.replaceChildren(
        el("p", "text-xs uppercase tracking-[0.35em] text-cyan-200", { text: playing ? "Now Playing" : "Paused" }),
        el("h2", "text-5xl font-black tracking-[-0.09em]", { text: current.name }),
        el("p", "font-mono text-sm text-white/45", { text: `${current.band} MHz • ${current.mood}` }),
        el("p", "text-xl font-bold text-white/85", { text: current.track }),
        append(el("div", "grid gap-2"), [append(el("div", "h-2 overflow-hidden rounded-full bg-white/10"), [progressFill]), append(el("div", "h-2 overflow-hidden rounded-full bg-white/10"), [meterFill])]),
        append(el("div", "flex flex-wrap justify-center gap-2 lg:justify-start"), [
          button("rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", playing ? "Pause" : "Play", () => {
            playing = !playing;
            render();
          }),
          button("rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20", favourites.has(current.name) ? "Unfavourite" : "Favourite", () => {
            favourites.has(current.name) ? favourites.delete(current.name) : favourites.add(current.name);
            persist();
            render();
          })
        ])
      );
      progressFill.style.width = `${progress}%`;
      meterFill.style.width = `${current.signal}%`;
      stationList.replaceChildren(el("p", "text-xs uppercase tracking-widest text-white/40", { text: "Stations" }));
      stations.forEach((station) => stationList.append(button(`rounded-2xl border px-3 py-2 text-left text-sm font-bold transition ${station.name === current.name ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"}`, `${favourites.has(station.name) ? "★ " : ""}${station.name}\n${station.band}`, () => tune(station))));
      recent.replaceChildren(el("p", "truncate", { text: history.length ? `Recent: ${history.join("  /  ")}` : "Recent: station history will appear here." }));
      volumeLabel.textContent = `${volume}%`;
    }

    const down = button("rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20", "Vol -", () => {
      volume = Math.max(0, volume - 8);
      persist();
      render();
    });
    const up = button("rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20", "Vol +", () => {
      volume = Math.min(100, volume + 8);
      persist();
      render();
    });

    append(deck, [now, stationList]);
    append(footer, [recent, append(el("div", "flex items-center justify-end gap-2"), [down, volumeLabel, up])]);
    append(root, [deck, footer]);
    const timer = window.setInterval(() => {
      if (!playing) return;
      progress = (progress + 1) % 100;
      progressFill.style.width = `${progress}%`;
    }, 900);
    root.addEventListener("remove", () => window.clearInterval(timer));
    render();
    return root;
  }
};
