import { append, el, icon, subtleButton } from "../../os/kernel/dom";
import { createNode, findNode, FS_CHANGED_EVENT, writeDocument } from "../../os/kernel/filesystem";
import type { AppManifest } from "../../os/kernel/types";

type SheetData = {
  version: 1;
  rows: number;
  cols: number;
  cells: Record<string, string>;
};

const DEFAULT_ROWS = 18;
const DEFAULT_COLS = 8;
const DEFAULT_PATH = "/Home/blair/Documents/Project Tracker.sheet";
const colName = (index: number) => {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
};
const colIndex = (name: string) => name.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
const address = (row: number, col: number) => `${colName(col)}${row + 1}`;

function parseCsv(body: string): SheetData {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const next = body[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else current += char;
  }
  row.push(current);
  rows.push(row);
  const cells: Record<string, string> = {};
  rows.forEach((items, rowIndex) => items.forEach((value, col) => {
    if (value) cells[address(rowIndex, col)] = value;
  }));
  return { version: 1, rows: Math.max(DEFAULT_ROWS, rows.length), cols: Math.max(DEFAULT_COLS, ...rows.map((items) => items.length)), cells };
}

function serializeCsv(data: SheetData) {
  const lines: string[] = [];
  for (let row = 0; row < data.rows; row += 1) {
    const items: string[] = [];
    for (let col = 0; col < data.cols; col += 1) {
      const raw = data.cells[address(row, col)] ?? "";
      items.push(/[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw);
    }
    lines.push(items.join(","));
  }
  return lines.join("\n");
}

function loadSheet(path: string): SheetData {
  const node = findNode(path);
  if (node?.body && path.toLowerCase().endsWith(".csv")) return parseCsv(node.body);
  if (node?.body) {
    try {
      const parsed = JSON.parse(node.body) as Partial<SheetData>;
      if (parsed.cells && typeof parsed.cells === "object") return { version: 1, rows: parsed.rows ?? DEFAULT_ROWS, cols: parsed.cols ?? DEFAULT_COLS, cells: parsed.cells };
    } catch {
      return parseCsv(node.body);
    }
  }
  return { version: 1, rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: {} };
}

function numberText(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  return String(value ?? "");
}

export const sheetsManifest: AppManifest = {
  id: "sheets",
  name: "Sheets",
  icon: "ph-table",
  defaultSize: { width: 940, height: 620 },
  render: (context) => {
    let path = String(context.process.data?.path || DEFAULT_PATH);
    let sheet = loadSheet(path);
    let selected = "A1";
    let savedBody = path.toLowerCase().endsWith(".csv") ? serializeCsv(sheet) : JSON.stringify(sheet);
    const inputs = new Map<string, HTMLInputElement>();

    const root = el("section", "grid h-full grid-rows-[auto_1fr_auto] overflow-hidden bg-slate-950/35 text-white");
    const title = el("div", "min-w-0");
    const pathLabel = el("p", "truncate font-mono text-xs text-white/45", { text: path });
    const formulaName = el("span", "w-14 shrink-0 rounded-xl border border-white/10 bg-white/8 px-2 py-2 text-center font-mono text-xs font-bold text-cyan-100", { text: selected });
    const formula = el("input", "min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-300/60", { value: "" }) as HTMLInputElement;
    const grid = el("div", "overflow-auto bg-slate-950/20");
    const status = el("p", "font-mono text-xs text-white/45");

    function raw(addr = selected) {
      return sheet.cells[addr] ?? "";
    }

    function rangeCells(range: string) {
      const [from, to] = range.toUpperCase().split(":");
      const start = from.match(/^([A-Z]+)(\d+)$/);
      const end = to?.match(/^([A-Z]+)(\d+)$/);
      if (!start || !end) return [];
      const r1 = Number(start[2]) - 1;
      const r2 = Number(end[2]) - 1;
      const c1 = colIndex(start[1]);
      const c2 = colIndex(end[1]);
      const out: string[] = [];
      for (let row = Math.min(r1, r2); row <= Math.max(r1, r2); row += 1) {
        for (let col = Math.min(c1, c2); col <= Math.max(c1, c2); col += 1) out.push(address(row, col));
      }
      return out;
    }

    function valueOf(addr: string, seen = new Set<string>()): string | number {
      const key = addr.toUpperCase();
      if (seen.has(key)) return "#CYCLE";
      const value = sheet.cells[key] ?? "";
      if (!value.startsWith("=")) return /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : value;
      seen.add(key);
      try {
        let expr = value.slice(1).trim();
        expr = expr.replace(/\b(SUM|AVG|MIN|MAX|COUNT)\(([^()]*)\)/gi, (_match, fn: string, args: string) => {
          const values = args.split(",").flatMap((part) => {
            const token = part.trim().toUpperCase();
            const refs = token.includes(":") ? rangeCells(token) : [token];
            return refs.map((ref) => Number(valueOf(ref, new Set(seen)) || 0)).filter((num) => Number.isFinite(num));
          });
          if (fn.toUpperCase() === "COUNT") return String(values.length);
          if (!values.length) return "0";
          if (fn.toUpperCase() === "AVG") return String(values.reduce((sum, num) => sum + num, 0) / values.length);
          if (fn.toUpperCase() === "MIN") return String(Math.min(...values));
          if (fn.toUpperCase() === "MAX") return String(Math.max(...values));
          return String(values.reduce((sum, num) => sum + num, 0));
        });
        expr = expr.replace(/\b[A-Z]+[1-9]\d*\b/g, (ref) => String(Number(valueOf(ref, new Set(seen)) || 0)));
        if (!/^[\d+\-*/().\s]+$/.test(expr)) return "#ERR";
        const result = Function(`"use strict"; return (${expr});`)() as number;
        return Number.isFinite(result) ? result : "#ERR";
      } catch {
        return "#ERR";
      }
    }

    function display(addr: string) {
      const value = raw(addr);
      return value.startsWith("=") ? numberText(valueOf(addr)) : value;
    }

    function currentBody() {
      return path.toLowerCase().endsWith(".csv") ? serializeCsv(sheet) : JSON.stringify(sheet, null, 2);
    }

    function updateDirty() {
      const dirty = currentBody() !== savedBody;
      pathLabel.textContent = `${path}${dirty ? " - edited" : ""}`;
      const selectedValues = [raw(selected), display(selected)].filter(Boolean).join(" -> ");
      status.textContent = `${selected} ${selectedValues || "blank"}`;
    }

    function repaintValues() {
      inputs.forEach((input, addr) => {
        if (document.activeElement !== input) input.value = display(addr);
      });
      updateDirty();
    }

    function select(addr: string) {
      selected = addr;
      formulaName.textContent = selected;
      formula.value = raw(selected);
      inputs.forEach((input, key) => input.classList.toggle("ring-2", key === selected));
      inputs.forEach((input, key) => input.classList.toggle("ring-cyan-300", key === selected));
      updateDirty();
    }

    function setCell(addr: string, value: string) {
      if (value) sheet.cells[addr] = value;
      else delete sheet.cells[addr];
      formula.value = raw(selected);
      repaintValues();
    }

    function renderGrid() {
      inputs.clear();
      const table = el("table", "min-w-full border-separate border-spacing-0 text-sm");
      const head = el("thead", "sticky top-0 z-10 bg-slate-900/95 text-xs text-white/50");
      const headRow = el("tr");
      headRow.append(el("th", "sticky left-0 z-20 w-12 border-b border-r border-white/10 bg-slate-900/95 p-2"));
      for (let col = 0; col < sheet.cols; col += 1) headRow.append(el("th", "min-w-28 border-b border-r border-white/10 px-3 py-2 text-center font-mono", { text: colName(col) }));
      head.append(headRow);
      const body = el("tbody");
      for (let row = 0; row < sheet.rows; row += 1) {
        const tr = el("tr");
        tr.append(el("th", "sticky left-0 z-10 border-b border-r border-white/10 bg-slate-900/95 px-2 py-1 text-right font-mono text-xs text-white/45", { text: String(row + 1) }));
        for (let col = 0; col < sheet.cols; col += 1) {
          const addr = address(row, col);
          const input = el("input", "h-9 w-full min-w-28 border-0 bg-transparent px-2 font-mono text-sm text-white outline-none transition focus:bg-cyan-300/10", { value: display(addr), spellcheck: false }) as HTMLInputElement;
          input.addEventListener("focus", () => { input.value = raw(addr); select(addr); });
          input.addEventListener("blur", () => { input.value = display(addr); });
          input.addEventListener("input", () => setCell(addr, input.value));
          input.addEventListener("keydown", (event) => {
            const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [1, 0] };
            const move = moves[event.key];
            if (!move || event.shiftKey || event.metaKey || event.ctrlKey) return;
            event.preventDefault();
            inputs.get(address(Math.max(0, Math.min(sheet.rows - 1, row + move[0])), Math.max(0, Math.min(sheet.cols - 1, col + move[1]))))?.focus();
          });
          inputs.set(addr, input);
          tr.append(append(el("td", "border-b border-r border-white/10 bg-white/[0.03] p-0 focus-within:bg-cyan-300/10"), [input]));
        }
        body.append(tr);
      }
      append(table, [head, body]);
      grid.replaceChildren(table);
      select(selected);
    }

    function save() {
      const body = currentBody();
      const existing = findNode(path);
      const error = existing ? writeDocument(path, body) : createNode(path, "document", body);
      if (error) context.notify(`Sheets: ${error}`);
      else {
        savedBody = body;
        context.notify(`Saved ${path}`);
        updateDirty();
      }
    }

    formula.addEventListener("input", () => setCell(selected, formula.value));
    window.addEventListener(FS_CHANGED_EVENT, () => {
      if (currentBody() !== savedBody) return;
      sheet = loadSheet(path);
      savedBody = currentBody();
      renderGrid();
    });

    const saveButton = el("button", `${subtleButton} flex items-center gap-2`, { type: "button" });
    append(saveButton, [icon("ph-floppy-disk", "text-lg"), "Save"]);
    saveButton.addEventListener("click", save);
    const addRow = el("button", subtleButton, { type: "button", text: "+ Row" });
    addRow.addEventListener("click", () => { sheet.rows += 1; renderGrid(); updateDirty(); });
    const addCol = el("button", subtleButton, { type: "button", text: "+ Column" });
    addCol.addEventListener("click", () => { sheet.cols += 1; renderGrid(); updateDirty(); });
    const exportCsv = el("button", subtleButton, { type: "button", text: "CSV" });
    exportCsv.addEventListener("click", () => {
      const csvPath = path.replace(/\.[^.]+$/, ".csv");
      const error = findNode(csvPath) ? writeDocument(csvPath, serializeCsv(sheet)) : createNode(csvPath, "document", serializeCsv(sheet));
      context.notify(error ?? `Exported ${csvPath}`);
    });

    append(title, [append(el("div", "flex items-center gap-3"), [icon("ph-table", "text-2xl text-emerald-200"), el("h2", "truncate text-sm font-black", { text: path.split("/").at(-1) ?? "Untitled.sheet" })]), pathLabel]);
    append(root, [
      append(el("header", "grid gap-3 border-b border-white/10 p-3"), [
        append(el("div", "flex flex-wrap items-center justify-between gap-3"), [title, append(el("div", "flex flex-wrap gap-2"), [addRow, addCol, exportCsv, saveButton])]),
        append(el("div", "flex min-w-0 items-center gap-2"), [formulaName, formula])
      ]),
      grid,
      append(el("footer", "flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2"), [status, el("p", "text-xs text-white/35", { text: "Formulas: =A1+B1, =SUM(A1:A5), =AVG(...), =MIN(...), =MAX(...), =COUNT(...)" })])
    ]);
    renderGrid();
    queueMicrotask(() => inputs.get(selected)?.focus());
    return root;
  }
};
