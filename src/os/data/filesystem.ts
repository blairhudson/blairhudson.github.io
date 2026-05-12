import { links } from "./links";

export type FsNodeType = "folder" | "app" | "link" | "document" | "program" | "trash";

export type FsNode = {
  id: string;
  name: string;
  path: string;
  type: FsNodeType;
  icon: string;
  body?: string;
  originalPath?: string;
  appId?: string;
  href?: string;
  children?: FsNode[];
};

const linkNodes: FsNode[] = links.map((link) => ({
  id: `link-${link.key}`,
  name: `${link.label}.webloc`,
  path: `/Home/blair/Links/${link.label}.webloc`,
  type: "link",
  icon: "ph-link-simple",
  href: link.href,
  body: link.subtitle
}));

export const filesystem: FsNode = {
  id: "root",
  name: "BlairOS",
  path: "/",
  type: "folder",
  icon: "ph-hard-drives",
  children: [
    {
      id: "desktop",
      name: "Desktop",
      path: "/Desktop",
      type: "folder",
      icon: "ph-desktop",
      children: [
        { id: "desktop-terminal", name: "Terminal", path: "/Desktop/Terminal", type: "app", icon: "ph-terminal-window", appId: "terminal" },
        { id: "desktop-browser", name: "Browser", path: "/Desktop/Browser", type: "app", icon: "ph-compass", appId: "browser" },
        { id: "desktop-files", name: "Files", path: "/Desktop/Files", type: "app", icon: "ph-folder-open", appId: "files" },
        { id: "desktop-code", name: "Code", path: "/Desktop/Code", type: "app", icon: "ph-code-block", appId: "code" },
        { id: "desktop-sheets", name: "Sheets", path: "/Desktop/Sheets", type: "app", icon: "ph-table", appId: "sheets" },
        {
          id: "desktop-readme",
          name: "README.txt",
          path: "/Desktop/README.txt",
          type: "document",
          icon: "ph-file-text",
          body: "Welcome to BlairOS v2. Open apps from Desktop, Dock, Launcher, Files, or /bin."
        },
        {
          id: "desktop-cv",
          name: "Blair Hudson CV.md",
          path: "/Desktop/Blair Hudson CV.md",
          type: "document",
          icon: "ph-identification-card",
          body: `# Blair Hudson
Australian AI and Software Engineering Leader. LinkedIn Top Voice.

## Contact
- Email: blairhudson@me.com
- LinkedIn: www.linkedin.com/in/blairhudson
- Location: Greater Sydney Area

## Top Skills
- Artificial Intelligence (AI)
- AI-powered development
- Strategy

## Current Roles
- Chief Engineer, Generative AI, Commonwealth Bank, November 2024 to present
- AI Researcher, deployscience labs, October 2024 to present

## Profile
AI and software engineering leader building enterprise-scale generative AI, data platforms, software teams, and product capability. Experience across banking, workforce skills, analytics, privacy technology, consulting, startups, devops, architecture, and engineering leadership.

## Selected Experience
- Commonwealth Bank: writing and running the Generative AI playbook at enterprise scale.
- Pearson: led 30+ person platform engineering team across Workforce Solutions, including AI systems, Databricks analytics, Kubernetes/Terraform, design systems, identity, APIs, docs, and ISO27001/27701 compliance.
- Practical Data Privacy: founded AI privacy compliance platform; acquired in December 2023.
- Faethm AI: Head of Engineering and Head of Engineering for Data Science through growth and Pearson acquisition.
- Macquarie Group: machine learning, analytics architecture, data science, cloud enablement, and BFS AI guild leadership.
- Pepper: innovation portfolio management for data-powered customer solutions.
- EY: analytics and enterprise intelligence consulting across fuel retail, banking, health, education, and energy.

## Education
- Bachelor of Information Technology, Information Systems and Software Technology, Macquarie University.

## Publications
- Unmet Needs and Service Priorities for ADHD in Australia: AI-Assisted Analysis of Senate Inquiry Submissions.

## Patent
- Artificial intelligence-based workforce management systems, methods, and media.`
        },
        {
          id: "desktop-agile-run-sheet",
          name: "Agile Weekend Run Sheet.sheet",
          path: "/Desktop/Agile Weekend Run Sheet.sheet",
          type: "document",
          icon: "ph-table",
          body: JSON.stringify({
            version: 1,
            rows: 16,
            cols: 7,
            cells: {
              A1: "Block",
              B1: "Task",
              C1: "Points",
              D1: "Done",
              A2: "Friday",
              B2: "Sketch app loop",
              C2: "3",
              D2: "yes",
              A3: "Saturday",
              B3: "Build working demo",
              C3: "8",
              D3: "yes",
              A4: "Sunday",
              B4: "Write proof note",
              C4: "5",
              D4: "next",
              B6: "Total points",
              C6: "=SUM(C2:C4)"
            }
          }, null, 2)
        },
        { id: "desktop-trash", name: "Trash", path: "/Desktop/Trash", type: "trash", icon: "ph-trash", appId: "trash" }
      ]
    },
    {
      id: "home",
      name: "Home",
      path: "/Home",
      type: "folder",
      icon: "ph-house",
      children: [
        {
          id: "home-blair",
          name: "blair",
          path: "/Home/blair",
          type: "folder",
          icon: "ph-user-circle",
          children: [
            { id: "links-folder", name: "Links", path: "/Home/blair/Links", type: "folder", icon: "ph-link", children: linkNodes },
            {
              id: "documents-folder",
              name: "Documents",
              path: "/Home/blair/Documents",
              type: "folder",
              icon: "ph-files",
              children: [
                {
                  id: "sheet-project-tracker",
                  name: "Project Tracker.sheet",
                  path: "/Home/blair/Documents/Project Tracker.sheet",
                  type: "document",
                  icon: "ph-table",
                  body: JSON.stringify({
                    version: 1,
                    rows: 18,
                    cols: 8,
                    cells: {
                      A1: "Project",
                      B1: "Status",
                      C1: "Score",
                      D1: "Next Move",
                      A2: "BlairOS",
                      B2: "shipping",
                      C2: "9",
                      D2: "add Sheets.app",
                      A3: "Agile Weekend",
                      B3: "live",
                      C3: "8",
                      D3: "capture run sheet",
                      A4: "SBX Agents",
                      B4: "active",
                      C4: "10",
                      D4: "publish proof",
                      B6: "Average",
                      C6: "=AVG(C2:C4)",
                      B7: "Total",
                      C7: "=SUM(C2:C4)"
                    }
                  }, null, 2)
                },
                {
                  id: "sheet-agent-budget",
                  name: "Agent Budget.csv",
                  path: "/Home/blair/Documents/Agent Budget.csv",
                  type: "document",
                  icon: "ph-table",
                  body: "Line,Monthly,Notes\nModels,180,prototype allocation\nExecution,90,sandbox runs\nCoffee,42,non-negotiable\nTotal,=SUM(B2:B4),formula survives import"
                }
              ]
            },
            {
              id: "code-folder",
              name: "Code",
              path: "/Home/blair/Code",
              type: "folder",
              icon: "ph-code-block",
              children: [
                {
                  id: "code-hello-js",
                  name: "hello.js",
                  path: "/Home/blair/Code/hello.js",
                  type: "document",
                  icon: "ph-file-js",
                  body: "const projects = ['sbx-agents', 'agile-weekend', 'skillcraft'];\n\nconsole.log('BlairOS Code running JS');\nconsole.log(projects.map((name) => name.toUpperCase()).join(' / '));\n\nreturn { ok: true, count: projects.length };\n"
                }
              ]
            },
            {
              id: "notes-folder",
              name: "Notes",
              path: "/Home/blair/Notes",
              type: "folder",
              icon: "ph-notebook",
              children: [
                {
                  id: "note-operating-model",
                  name: "operating-model.md",
                  path: "/Home/blair/Notes/operating-model.md",
                  type: "document",
                  icon: "ph-file-md",
                  body: "Small teams, sharp tools, visible systems, and production feedback loops."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "field-notes",
      name: "Field Notes",
      path: "/Field Notes",
      type: "folder",
      icon: "ph-sparkle",
      children: [
        {
          id: "field-notes-weekend-sprint",
          name: "weekend-sprint-report.md",
          path: "/Field Notes/weekend-sprint-report.md",
          type: "document",
          icon: "ph-file-md",
          body: "# Weekend Sprint Report\n\nTokens diverted away from workslop and into weekend projects.\n\nScorecard:\n- Learn by building: green\n- Proof of work: visible\n- Badge energy: low\n- Useful toy factor: rising\n\nReminder: build the thing, then write the evidence."
        },
        {
          id: "field-notes-rapid-systemisation",
          name: "rapid-systemisation.md",
          path: "/Field Notes/rapid-systemisation.md",
          type: "document",
          icon: "ph-file-md",
          body: "# Rapid Systemisation\n\nAI usage is not capability by itself. Capability improves when task patterns become explicit, repeatable, and improvable.\n\nScale unit: individual + system.\n\nThe slow part is capturing patterns. The fast part arrives after enough patterns become durable."
        },
        {
          id: "field-notes-sublight",
          name: "sublight-engines.md",
          path: "/Field Notes/sublight-engines.md",
          type: "document",
          icon: "ph-file-md",
          body: "# Sublight Engines\n\nDo not jump straight to lightspeed. First, make workflows operate.\n\nAI belongs inside real jobs, forms, decisions, handoffs, and feedback loops. Chat is useful. Workflow is where adoption compounds."
        },
        {
          id: "field-notes-context-compaction",
          name: "context-compaction.md",
          path: "/Field Notes/context-compaction.md",
          type: "document",
          icon: "ph-file-md",
          body: "# Context Compaction\n\nNew roles do not start with empty context. They start with compressed prior judgment.\n\nKeep: systems, edge cases, people patterns, instincts.\nDrop: stale detail.\nReload: new local reality."
        }
      ]
    },
    {
      id: "applications",
      name: "Applications",
      path: "/Applications",
      type: "folder",
      icon: "ph-squares-four",
      children: [
        { id: "app-terminal", name: "Terminal.app", path: "/Applications/Terminal.app", type: "app", icon: "ph-terminal-window", appId: "terminal" },
        { id: "app-browser", name: "Browser.app", path: "/Applications/Browser.app", type: "app", icon: "ph-compass", appId: "browser" },
        { id: "app-files", name: "Files.app", path: "/Applications/Files.app", type: "app", icon: "ph-folder-open", appId: "files" },
        { id: "app-code", name: "Code.app", path: "/Applications/Code.app", type: "app", icon: "ph-code-block", appId: "code" },
        { id: "app-sheets", name: "Sheets.app", path: "/Applications/Sheets.app", type: "app", icon: "ph-table", appId: "sheets" },
        { id: "app-editor", name: "Text Editor.app", path: "/Applications/Text Editor.app", type: "app", icon: "ph-note-pencil", appId: "editor" },
        { id: "app-notes", name: "Notes.app", path: "/Applications/Notes.app", type: "app", icon: "ph-notebook", appId: "notes" },
        { id: "app-preview", name: "Preview.app", path: "/Applications/Preview.app", type: "app", icon: "ph-eye", appId: "preview" },
        { id: "app-activity-monitor", name: "Activity Monitor.app", path: "/Applications/Activity Monitor.app", type: "app", icon: "ph-pulse", appId: "activityMonitor" },
        { id: "app-console", name: "Console.app", path: "/Applications/Console.app", type: "app", icon: "ph-list-magnifying-glass", appId: "console" },
        { id: "app-system-profiler", name: "System Profiler.app", path: "/Applications/System Profiler.app", type: "app", icon: "ph-cpu", appId: "systemProfiler" },
        { id: "app-disk-utility", name: "Disk Utility.app", path: "/Applications/Disk Utility.app", type: "app", icon: "ph-hard-drive", appId: "diskUtility" },
        { id: "app-network-utility", name: "Network Utility.app", path: "/Applications/Network Utility.app", type: "app", icon: "ph-wifi-high", appId: "networkUtility" },
        { id: "app-calculator", name: "Calculator.app", path: "/Applications/Calculator.app", type: "app", icon: "ph-calculator", appId: "calculator" },
        { id: "app-mail", name: "Mail.app", path: "/Applications/Mail.app", type: "app", icon: "ph-envelope-simple", appId: "mail" },
        { id: "app-radio", name: "Radio.app", path: "/Applications/Radio.app", type: "app", icon: "ph-radio", appId: "radio" },
        { id: "app-git", name: "Git.app", path: "/Applications/Git.app", type: "app", icon: "ph-git-branch", appId: "git" },
        { id: "app-blair-drive", name: "BlairDrive.app", path: "/Applications/BlairDrive.app", type: "app", icon: "ph-cloud-check", appId: "blairDrive" },
        { id: "app-package-manager", name: "Package Manager.app", path: "/Applications/Package Manager.app", type: "app", icon: "ph-package", appId: "packageManager" },
        { id: "app-settings", name: "Settings.app", path: "/Applications/Settings.app", type: "app", icon: "ph-gear-six", appId: "settings" },
        { id: "app-about", name: "About.app", path: "/Applications/About.app", type: "app", icon: "ph-info", appId: "about" }
      ]
    },
    {
      id: "system",
      name: "System",
      path: "/System",
      type: "folder",
      icon: "ph-cpu",
      children: [
        {
          id: "system-secrets",
          name: ".secrets",
          path: "/System/.secrets",
          type: "folder",
          icon: "ph-lock-key",
          children: [
            {
              id: "system-secrets-readme",
              name: "README.md",
              path: "/System/.secrets/README.md",
              type: "document",
              icon: "ph-file-md",
              body: "# BlairOS Root Notes\n\nIf you found this, the machine trusts you.\n\nRules:\n- Keep the illusion intact.\n- Ship useful toys.\n- Never let a demo become boring.\n\nRoot password hint: there is no root password. Blair is already root."
            }
          ]
        }
      ]
    },
    {
      id: "projects",
      name: "Projects",
      path: "/Projects",
      type: "folder",
      icon: "ph-cube",
      children: [
        {
          id: "project-sbx",
          name: "sbx-agents.project",
          path: "/Projects/sbx-agents.project",
          type: "document",
          icon: "ph-cpu",
          body: "Sandboxed coding-agent SDK across Docker SBX, Docker, and custom execution environments."
        },
        {
          id: "project-agile-weekend",
          name: "agile-weekend.project",
          path: "/Projects/agile-weekend.project",
          type: "document",
          icon: "ph-calendar-check",
          body: "Weekend project planner with outcome capture and shareable updates."
        }
      ]
    },
    {
      id: "writing",
      name: "Writing",
      path: "/Writing",
      type: "folder",
      icon: "ph-feather",
      children: [
        { id: "writing-substack", name: "sublight.substack.webloc", path: "/Writing/sublight.substack.webloc", type: "link", icon: "ph-newspaper", href: "https://sublight.substack.com", body: "Essays on AI, work, and future in Australia." }
      ]
    },
    {
      id: "research",
      name: "Research",
      path: "/Research",
      type: "folder",
      icon: "ph-flask",
      children: [
        { id: "research-deployscience", name: "deployscience-labs.webloc", path: "/Research/deployscience-labs.webloc", type: "link", icon: "ph-atom", href: "https://deployscience.com/publications/", body: "AI research and publications." }
      ]
    },
    {
      id: "bin",
      name: "bin",
      path: "/bin",
      type: "folder",
      icon: "ph-terminal",
      children: [
        "help", "sh", "ls", "cd", "pwd", "cat", "echo", "open", "date", "env", "uname", "whoami", "hostname", "which", "man",
        "tree", "find", "grep", "less", "more", "wc", "head", "tail", "sort", "uniq", "file", "stat", "du", "df", "basename", "dirname", "ps", "top", "uptime", "kill",
        "history", "alias", "export", "sudo", "workslop", "sprint", "compact", "systemise", "systemize", "sublight", "proof", "broadband", "chatbox", "ping", "traceroute", "dig", "nslookup", "nmap", "curl", "wget", "brew", "apt", "mkdir", "rm", "touch", "cp", "mv", "ln", "chmod", "chown", "tar", "zip", "unzip", "nano", "edit", "sheets", "coffee", "clear", "sleep", "fortune", "reboot", "matrix"
      ].map((program) => ({
        id: `bin-${program}`,
        name: program,
        path: `/bin/${program}`,
        type: "program" as const,
        icon: "ph-file-code",
        body: `Executable program: ${program}`
      }))
    },
    {
      id: "trash",
      name: "Trash",
      path: "/Trash",
      type: "trash",
      icon: "ph-trash",
      children: [
        { id: "trash-old", name: "old-homepage.html", path: "/Trash/old-homepage.html", originalPath: "/Desktop/old-homepage.html", type: "link", icon: "ph-file-html", href: "blairos://Desktop/old-homepage.html", body: "Recovered BlairOS v1 homepage." },
        { id: "trash-draft", name: "draft-that-got-too-corporate.txt", path: "/Trash/draft-that-got-too-corporate.txt", type: "document", icon: "ph-file-text", body: "Deleted for sounding too normal." }
      ]
    }
  ]
};
