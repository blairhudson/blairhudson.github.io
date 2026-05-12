import { append, bindButtonAction, button, el, subtleButton } from "../../os/kernel/dom";
import { settings, updateSettings, type OsSettings } from "../../os/kernel/settings";
import type { AppManifest } from "../../os/kernel/types";

export const settingsManifest: AppManifest = {
  id: "settings",
  name: "Settings",
  icon: "ph-gear-six",
  defaultSize: { width: 760, height: 620 },
  render: () => {
    const root = el("section", "grid h-full grid-rows-[auto_1fr] gap-5 overflow-hidden p-5 text-white");
    const title = el("div", "rounded-[28px] border border-white/15 bg-white/10 p-5");
    append(title, [el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "System Settings" }), el("p", "mt-2 text-sm text-white/60", { text: "Preferences stay with this machine." })]);

    const controls = el("div", "grid content-start gap-4 overflow-auto");

    function section(name: string, description: string, children: HTMLElement[]) {
      return append(el("section", "grid gap-3 rounded-3xl border border-white/10 bg-black/25 p-4"), [
        append(el("div"), [el("h3", "text-sm font-bold uppercase tracking-widest text-white/45", { text: name }), el("p", "mt-1 text-sm text-white/55", { text: description })]),
        append(el("div", "grid gap-2 sm:grid-cols-3"), children)
      ]);
    }

    function choice<T extends keyof OsSettings>(label: string, key: T, value: OsSettings[T], palette = "") {
      const row = el("button", `${subtleButton} grid gap-2 text-left`, { type: "button" });
      const paint = el("span", `h-12 rounded-2xl border border-white/10 ${palette || "bg-white/10"}`);
      const text = el("span", "font-semibold", { text: label });
      const state = el("span", "font-mono text-xs text-cyan-100");
      const render = () => {
        const active = settings.get()[key] === value;
        row.classList.toggle("border-cyan-300/50", active);
        row.classList.toggle("bg-cyan-300/10", active);
        state.textContent = active ? "selected" : String(value);
      };
      bindButtonAction(row, () => updateSettings({ [key]: value }));
      settings.subscribe(render);
      append(row, [paint, append(el("span", "flex items-center justify-between gap-2"), [text, state])]);
      render();
      return row;
    }

    function toggle(label: string, description: string, key: "reduceMotion" | "showGrid" | "clock24h") {
      const row = el("button", `${subtleButton} flex items-center justify-between gap-3`, { type: "button" });
      const state = el("span", "font-mono text-xs text-cyan-100");
      const render = () => {
        const value = settings.get()[key];
        state.textContent = value ? "on" : "off";
        row.classList.toggle("border-cyan-300/50", value);
        row.classList.toggle("bg-cyan-300/10", value);
      };
      bindButtonAction(row, () => updateSettings({ [key]: !settings.get()[key] }));
      settings.subscribe(render);
      append(row, [append(el("span"), [el("span", "block font-semibold", { text: label }), el("span", "block text-xs text-white/45", { text: description })]), state]);
      render();
      return row;
    }

    const reset = button("rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20", "Reset Defaults", () => updateSettings({ theme: "night", density: "roomy", dockSize: "standard", showGrid: true, clock24h: true, reduceMotion: false }));

    const renderControls = () => {
      controls.replaceChildren(
        section("Theme", "Choose desktop colour mood.", [
          choice("Night", "theme", "night", "bg-[linear-gradient(135deg,#08111f,#1b1230,#051018)]"),
          choice("Dawn", "theme", "dawn", "bg-[linear-gradient(135deg,#22304f,#7d4f70,#192032)]"),
          choice("Forest", "theme", "forest", "bg-[linear-gradient(135deg,#071c17,#183a24,#060d0b)]")
        ]),
        section("Interface", "Tune window spacing and Dock footprint.", [
          choice("Roomy", "density", "roomy"),
          choice("Compact", "density", "compact"),
          choice("Small Dock", "dockSize", "compact"),
          choice("Standard Dock", "dockSize", "standard"),
          choice("Large Dock", "dockSize", "large")
        ]),
        section("Desktop", "Control ambient chrome.", [
          toggle("Wallpaper grid", "Subtle desktop line grid.", "showGrid"),
          toggle("24-hour clock", "Use compact menu-bar time.", "clock24h"),
          toggle("Reduced motion", "Minimise movement effects.", "reduceMotion")
        ]),
        reset
      );
    };
    renderControls();
    append(root, [title, controls]);
    return root;
  }
};
