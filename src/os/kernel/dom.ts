export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  attrs: Record<string, string | number | boolean> = {}
) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = String(value);
    else if (key === "html") node.innerHTML = String(value);
    else if (typeof value === "boolean") node.toggleAttribute(key, value);
    else node.setAttribute(key, String(value));
  }
  return node;
}

export function icon(name: string, className = "text-3xl") {
  return el("i", `ph ${name} ${className}`);
}

export function append(parent: HTMLElement, children: Array<HTMLElement | string | null | undefined>) {
  for (const child of children) {
    if (!child) continue;
    parent.append(child instanceof HTMLElement ? child : document.createTextNode(child));
  }
  return parent;
}

export function bindButtonAction<T extends HTMLElement>(node: T, onClick: (event: Event) => void) {
  let skipSyntheticClick = false;
  node.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") event.stopPropagation();
  });
  node.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    if (!node.contains(document.elementFromPoint(event.clientX, event.clientY))) return;
    event.preventDefault();
    event.stopPropagation();
    skipSyntheticClick = true;
    onClick(event);
    window.setTimeout(() => {
      skipSyntheticClick = false;
    });
  });
  node.addEventListener("click", (event) => {
    if (skipSyntheticClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick(event);
  });
  return node;
}

export function button(className: string, label: string, onClick: () => void) {
  const node = el("button", className, { type: "button" });
  node.textContent = label;
  return bindButtonAction(node, onClick);
}

export const glass = "border border-white/15 bg-slate-950/55 shadow-2xl shadow-black/40 backdrop-blur-2xl";
export const subtleButton = "rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/25 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/50";
