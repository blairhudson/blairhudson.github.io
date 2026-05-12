import { append, bindButtonAction, button, el, subtleButton } from "../../os/kernel/dom";
import type { AppManifest } from "../../os/kernel/types";

type MailMessage = {
  id: string;
  box: "inbox" | "sent";
  from: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  unread?: boolean;
  flagged?: boolean;
};

const DRAFT_KEY = "blairos.mail.draft.v1";
const SENT_KEY = "blairos.mail.sent.v1";

const seededSentMessages: MailMessage[] = [
  {
    id: "sent-weekend-sprint",
    box: "sent",
    from: "Blair Hudson",
    to: "self@blairos.local",
    subject: "Weekend sprint report",
    preview: "Point the tokens at weekend projects. Learn by building stuff.",
    body: "Reminder for next post: everyone needs to ease up on the workslop and point those tokens at weekend projects. Show the build log, keep it practical, ask how the sprint landed.",
    date: "Drafted"
  },
  {
    id: "sent-systemisation-thesis",
    box: "sent",
    from: "Blair Hudson",
    to: "sublight@blairos.local",
    subject: "Rapid systemisation thesis",
    preview: "Usage is up, but capability only improves when task patterns become durable.",
    body: "Core line: scale is no longer headcount alone. In software engineering, the unit of scale is the individual plus the system they operate within. The post should make that feel obvious.",
    date: "Queued"
  },
  {
    id: "sent-sublight-transition",
    box: "sent",
    from: "Blair Hudson",
    to: "future-work@blairos.local",
    subject: "Chat is not the workflow",
    preview: "AI has to live where real work happens, not only in a chat box.",
    body: "Keep the argument grounded: developers are seeing the teaser trailer first. The broader opportunity is tools embedded in real jobs, admin flows, decisions, and handoffs.",
    date: "Pinned"
  }
];

const inboxMessages: MailMessage[] = [
  {
    id: "welcome",
    box: "inbox",
    from: "BlairOS",
    to: "blairhudson@me.com",
    subject: "Your desktop is ready",
    preview: "Apps, files, commands, and restored artifacts are online.",
    body: "WindowServer finished boot. Terminal history, Files, Browser, Package Manager, Git, and Mail are ready. Desktop state is restored where available.",
    date: "09:12",
    unread: true
  },
  {
    id: "research",
    box: "inbox",
    from: "DeployScience Labs",
    to: "blairhudson@me.com",
    subject: "Research digest",
    preview: "Fresh notes on agents, infrastructure, and evaluation loops.",
    body: "This week: sandboxed agents, practical eval loops, and where local execution gives teams faster feedback. Worth turning into a short field note.",
    date: "Yesterday",
    flagged: true
  },
  {
    id: "sublight",
    box: "inbox",
    from: "sublight",
    to: "blairhudson@me.com",
    subject: "Draft queued",
    preview: "A sharper essay wants one more pass before publishing.",
    body: "Working title: the operating system returns as a product interface. Needs tighter intro, fewer abstractions, stronger ending.",
    date: "Mon"
  },
  {
    id: "contact",
    box: "inbox",
    from: "LinkedIn",
    to: "blairhudson@me.com",
    subject: "New AI leadership conversation",
    preview: "Someone wants to talk about applied generative AI systems.",
    body: "A platform leader asked about enterprise AI delivery, developer tooling, and measurable adoption. Reply with a short note and suggest a call.",
    date: "Sun",
    unread: true
  }
];

function readSent() {
  try {
    const saved = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as MailMessage[];
    const missing = seededSentMessages.filter((seed) => !saved.some((message) => message.id === seed.id));
    return [...missing, ...saved];
  } catch {
    return seededSentMessages;
  }
}

function writeSent(messages: MailMessage[]) {
  localStorage.setItem(SENT_KEY, JSON.stringify(messages));
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as { to?: string; subject?: string; body?: string };
  } catch {
    return {};
  }
}

function writeDraft(draft: { to: string; subject: string; body: string }) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export const mailManifest: AppManifest = {
  id: "mail",
  name: "Mail",
  icon: "ph-envelope-simple",
  defaultSize: { width: 920, height: 620 },
  render: (context) => {
    let box: "inbox" | "sent" = "inbox";
    let selectedId = inboxMessages[0]?.id ?? "";
    const root = el("section", "grid h-full grid-cols-[170px_300px_1fr] overflow-hidden text-white max-lg:grid-cols-[240px_1fr] max-sm:grid-cols-1");
    const sidebar = el("aside", "grid content-start gap-2 border-r border-white/10 bg-black/15 p-4 max-sm:hidden");
    const listPane = el("section", "grid min-h-0 grid-rows-[auto_1fr] border-r border-white/10 bg-slate-950/25 max-sm:border-r-0");
    const reader = el("main", "min-h-0 overflow-auto p-5");
    const search = el("input", "m-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60", { placeholder: "Search mail" }) as HTMLInputElement;
    const rows = el("div", "grid content-start gap-2 overflow-auto p-3 pt-0");

    function messages() {
      return [...inboxMessages, ...readSent()].filter((message) => message.box === box);
    }

    function open(message: MailMessage) {
      selectedId = message.id;
      message.unread = false;
      reader.replaceChildren();
      append(reader, [
        append(el("div", "flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4"), [
          append(el("div"), [
            el("p", "text-sm uppercase tracking-widest text-cyan-200", { text: message.from }),
            el("h2", "mt-2 text-3xl font-black tracking-[-0.07em]", { text: message.subject }),
            el("p", "mt-2 font-mono text-xs text-white/40", { text: `To ${message.to} • ${message.date}` })
          ]),
          append(el("div", "flex gap-2"), [
            button("rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20", "Reply", () => compose(message.from, `Re: ${message.subject}`, `\n\nOn ${message.date}, ${message.from} wrote:\n${message.body}`)),
            button("rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", "Compose", () => compose())
          ])
        ]),
        el("p", "mt-5 whitespace-pre-wrap leading-7 text-white/75", { text: message.body }),
        append(el("div", "mt-6 flex flex-wrap gap-2"), [
          button("rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20", "Copy Blair Email", () => navigator.clipboard?.writeText("blairhudson@me.com").then(() => context.notify("Copied blairhudson@me.com"))),
          button("rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20", "Open LinkedIn", () => context.launchApp("browser", { url: "https://linkedin.com/in/blairhudson" }))
        ])
      ]);
      renderList();
    }

    function compose(to = "", subject = "", body = "") {
      const draft = readDraft();
      reader.replaceChildren();
      const toInput = el("input", "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300/60", { placeholder: "To", value: to || draft.to || "" }) as HTMLInputElement;
      const subjectInput = el("input", "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300/60", { placeholder: "Subject", value: subject || draft.subject || "" }) as HTMLInputElement;
      const bodyInput = el("textarea", "min-h-72 resize-none rounded-3xl border border-white/10 bg-black/30 p-4 leading-7 text-white outline-none focus:border-cyan-300/60", { placeholder: "Write message..." }) as HTMLTextAreaElement;
      bodyInput.value = body || draft.body || "";
      const save = () => writeDraft({ to: toInput.value, subject: subjectInput.value, body: bodyInput.value });
      [toInput, subjectInput, bodyInput].forEach((field) => field.addEventListener("input", save));
      append(reader, [
        append(el("div", "flex items-center justify-between gap-3"), [el("h2", "text-3xl font-black tracking-[-0.07em]", { text: "New Message" }), button("rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", "Send", () => {
          const sent = readSent();
          const message: MailMessage = { id: `sent-${Date.now()}`, box: "sent", from: "Blair Hudson", to: toInput.value || "draft", subject: subjectInput.value || "(no subject)", preview: bodyInput.value.slice(0, 80) || "Sent from BlairOS Mail.", body: bodyInput.value || "Sent from BlairOS Mail.", date: "Now" };
          writeSent([message, ...sent]);
          localStorage.removeItem(DRAFT_KEY);
          box = "sent";
          selectedId = message.id;
          context.notify(`Sent: ${message.subject}`);
          renderNav();
          renderList();
          open(message);
        })]),
        append(el("div", "mt-4 grid gap-3"), [toInput, subjectInput, bodyInput])
      ]);
    }

    function renderNav() {
      sidebar.replaceChildren();
      append(sidebar, [
        el("h2", "mb-2 text-2xl font-black tracking-[-0.07em]", { text: "Mail" }),
        button(`${subtleButton} ${box === "inbox" ? "border-cyan-300/50 bg-cyan-300/10" : ""}`, `Inbox (${inboxMessages.length})`, () => {
          box = "inbox";
          selectedId = inboxMessages[0]?.id ?? "";
          renderNav();
          renderList();
        }),
        button(`${subtleButton} ${box === "sent" ? "border-cyan-300/50 bg-cyan-300/10" : ""}`, `Sent (${readSent().length})`, () => {
          box = "sent";
          selectedId = readSent()[0]?.id ?? "";
          renderNav();
          renderList();
        }),
        button("mt-2 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200", "Compose", () => compose("", "", ""))
      ]);
    }

    function renderList() {
      const query = search.value.trim().toLowerCase();
      const filtered = messages().filter((message) => [message.from, message.subject, message.preview, message.body].join(" ").toLowerCase().includes(query));
      rows.replaceChildren();
      filtered.forEach((message) => {
        const row = el("button", `${subtleButton} ${message.id === selectedId ? "border-cyan-300/50 bg-cyan-300/10" : ""}`, { type: "button" });
        append(row, [
          append(el("span", "flex items-center justify-between gap-2"), [el("span", `block truncate text-xs ${message.unread ? "font-bold text-cyan-100" : "text-white/45"}`, { text: message.from }), el("span", "font-mono text-[0.65rem] text-white/35", { text: message.date })]),
          el("span", `mt-1 block truncate ${message.unread ? "font-black" : "font-bold"}`, { text: `${message.flagged ? "★ " : ""}${message.subject}` }),
          el("span", "mt-1 line-clamp-2 text-xs text-white/45", { text: message.preview })
        ]);
        bindButtonAction(row, () => open(message));
        rows.append(row);
      });
      const selected = filtered.find((message) => message.id === selectedId) ?? filtered[0];
      if (selected) open(selected);
      else reader.replaceChildren(el("p", "p-5 text-sm text-white/55", { text: "No messages." }));
    };

    search.addEventListener("input", renderList);
    append(listPane, [search, rows]);
    append(root, [sidebar, listPane, reader]);
    renderNav();
    renderList();
    return root;
  }
};
