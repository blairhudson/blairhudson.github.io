export type LinkItem = {
  key: string;
  label: string;
  subtitle: string;
  href: string;
  tags: string[];
};

export const links: LinkItem[] = [
  {
    key: "clawkeys",
    label: "Clawkeys",
    subtitle: "The opencode keypad meme brought to life.",
    href: "https://github.com/blairhudson/clawkeys",
    tags: ["hardware", "opencode", "github"]
  },
  {
    key: "sbx-agents",
    label: "sbx-agents",
    subtitle: "Coding agents in sandboxes.",
    href: "https://blairhudson.com/sbx-agents/",
    tags: ["agents", "sandbox", "sdk"]
  },
  {
    key: "agile-weekend",
    label: "Agile Weekend",
    subtitle: "Plan a weekend project, track what happened, share the outcome.",
    href: "https://blairhudson.com/agile-weekend/",
    tags: ["projects", "planning", "weekend"]
  },
  {
    key: "skillcraft",
    label: "Skillcraft.gg",
    subtitle: "Prove AI coding skills.",
    href: "https://skillcraft.gg/",
    tags: ["assessment", "ai", "coding"]
  },
  {
    key: "awdl-jit",
    label: "awdl-jit",
    subtitle: "Launch GeForce NOW on macOS with AWDL control just in time.",
    href: "https://blairhudson.com/awdl-jit/",
    tags: ["macos", "networking", "gaming"]
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    subtitle: "Career and startup conversations.",
    href: "https://linkedin.com/in/blairhudson",
    tags: ["contact", "career", "social"]
  },
  {
    key: "work-with-me",
    label: "Work With Me",
    subtitle: "Connect on LinkedIn to discuss current opportunities.",
    href: "https://cba.wd3.myworkdayjobs.com/en-US/CommBank_Careers/jobs?q=generative+ai&locationCountry=d903bb3fedad45039383f6de334ad4db",
    tags: ["career", "jobs", "ai"]
  },
  {
    key: "substack",
    label: "Substack",
    subtitle: "Thoughts on AI, work, and future in Australia.",
    href: "https://sublight.substack.com",
    tags: ["writing", "essays", "ai"]
  },
  {
    key: "deployscience-labs",
    label: "DeployScience Labs",
    subtitle: "AI research layer.",
    href: "https://deployscience.com/publications/",
    tags: ["research", "papers", "ai"]
  },
  {
    key: "github",
    label: "GitHub",
    subtitle: "Projects and code.",
    href: "https://github.com/blairhudson/",
    tags: ["code", "projects", "github"]
  },
  {
    key: "fastapi-agents",
    label: "FastAPI Agents",
    subtitle: "Build and deploy with agents.",
    href: "https://fastapi-agents.blairhudson.com",
    tags: ["future", "agents", "fastapi"]
  }
];

export const linkAliases = new Map<string, LinkItem>();

for (const link of links) {
  linkAliases.set(link.key, link);
  linkAliases.set(link.label.toLowerCase(), link);
  linkAliases.set(link.label.toLowerCase().replace(/\s+/g, "-"), link);
}

for (const [alias, key] of Object.entries({
  sbx: "sbx-agents",
  sbxa: "sbx-agents",
  "coding-agents": "sbx-agents",
  "sandbox-agents": "sbx-agents",
  agile: "agile-weekend",
  weekend: "agile-weekend",
  skillcraft: "skillcraft",
  "skillcraft.gg": "skillcraft",
  contact: "linkedin",
  work: "work-with-me",
  career: "work-with-me",
  writing: "substack",
  research: "deployscience-labs",
  deployscience: "deployscience-labs",
  code: "github",
  future: "fastapi-agents",
  fastapi: "fastapi-agents"
})) {
  const target = links.find((link) => link.key === key);
  if (target) {
    linkAliases.set(alias, target);
  }
}
