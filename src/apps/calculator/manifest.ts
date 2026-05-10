import { append, button, el } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

export const calculatorManifest: AppManifest = {
  id: "calculator",
  name: "Calculator",
  icon: "ph-calculator",
  defaultSize: { width: 360, height: 500 },
  render: () => {
    let expression = "";
    const root = el("section", "grid h-full grid-rows-[auto_1fr] gap-4 p-5 text-white");
    const display = el("div", "overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-5 text-right font-mono text-3xl", { text: "0" });
    const keys = el("div", "grid grid-cols-4 gap-2");
    const set = () => (display.textContent = expression || "0");
    const press = (key: string) => {
      if (key === "C") expression = "";
      else if (key === "=") {
        try {
          expression = /^[\d+\-*/().\s]+$/.test(expression) ? String(Function(`return (${expression})`)()) : "Error";
        } catch {
          expression = "Error";
        }
      } else expression = expression === "Error" ? key : expression + key;
      set();
    };
    ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+", "C"].forEach((key) => keys.append(button(`rounded-2xl ${key === "=" ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white"} p-4 text-xl font-black hover:bg-white/20`, key, () => press(key))));
    append(root, [display, keys]);
    return root;
  }
};
