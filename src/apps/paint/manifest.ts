import { append, button, el } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

export const paintManifest: AppManifest = {
  id: "paint",
  name: "Paint",
  icon: "ph-paint-brush",
  defaultSize: { width: 720, height: 520 },
  render: () => {
    let color = "#67e8f9";
    let drawing = false;
    const root = el("section", "grid h-full grid-rows-[auto_1fr] bg-slate-950/55 text-white");
    const toolbar = el("div", "flex flex-wrap items-center gap-2 border-b border-white/10 p-3");
    const canvasWrap = el("div", "min-h-0 p-4");
    const canvas = el("canvas", "h-full w-full rounded-[24px] border border-white/10 bg-white shadow-2xl") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const image = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
      if (!ctx) return;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (image) ctx.putImageData(image, 0, 0);
    }

    function point(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    ["#67e8f9", "#f472b6", "#facc15", "#4ade80", "#111827"].forEach((swatch) => {
      const item = el("button", "h-8 w-8 rounded-full border border-white/25", { type: "button", title: swatch }) as HTMLButtonElement;
      item.style.background = swatch;
      item.addEventListener("click", () => (color = swatch));
      toolbar.append(item);
    });
    toolbar.append(button("rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20", "Clear", () => ctx?.clearRect(0, 0, canvas.width, canvas.height)));

    canvas.addEventListener("pointerdown", (event) => {
      if (!ctx) return;
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const pos = point(event);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drawing || !ctx) return;
      const pos = point(event);
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });
    canvas.addEventListener("pointerup", () => (drawing = false));
    canvas.addEventListener("pointercancel", () => (drawing = false));

    append(canvasWrap, [canvas]);
    append(root, [toolbar, canvasWrap]);
    requestAnimationFrame(resize);
    new ResizeObserver(resize).observe(canvasWrap);
    return root;
  }
};
