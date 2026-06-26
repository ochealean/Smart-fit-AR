# Case Study Workflow — Aki1104 Projects

> A reusable prompt + rules for turning **any** project into a clean, market-oriented case study.
> Paste the prompt block below into any project, answer the few questions it asks, and you get a
> consistent `project<name>.md` write-up every time.
>
> This is **not** a README. For READMEs use `./readme-template.md`. This file produces the
> *narrative / portfolio case study* (Project Overview · Goal · Approach · Outcome).

---

## How to use (3 steps)

1. Open the project you want documented and paste the **PROMPT BLOCK** below to your AI assistant.
2. Answer the up-front questions it asks (client vs passion, industry, timeline, etc.).
3. It reads the actual codebase and writes a `project<name>.md` case study into `docs/`.

A finished, real example lives at **[`./projectdubaifleamarket.md`](./projectdubaifleamarket.md)** — that is the target quality.

---

## Questions to clarify before the AI writes anything

These are the questions an AI **must** ask (or you must answer up front) for every project. Without these, the case study will have placeholders or wrong framing.

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | **Client or passion project?** If client — who are they, what is their business, and what was their pain? | Changes the entire tone: client = problem/solution/impact; passion = skills/credibility. If client details are missing, the AI must ask before writing. |
| 2 | **What industry?** (e.g. clothing brand, government, food, real estate) | Sets the context and framing for a reader who doesn't know the space. |
| 3 | **Timeline?** How long from zero to first live version? | Used to apply the rounding rule (4 weeks → "1 month", 5 weeks → "1 month and 1 week", etc.). |
| 4 | **Who built it?** Solo, or a team — and what was each person's role? | Determines whether to write "I" or "we", and whether to name team members. |
| 5 | **How did you learn the client's process?** (meetings, walkthroughs, interviews, reviewing their paper records?) | Makes the research section feel real, not generic. One concrete sentence here is worth a paragraph of vague "we researched." |
| 6 | **How many records / users does the system have today?** Even rough counts ("1,000+ records", "~10 daily users"). | Adds credibility to the Outcome with real numbers instead of adjectives. |
| 7 | **What was the before/after time for the key painful task?** (e.g. "was: 30 min in Messenger; now: 30 seconds") | The strongest metric in any case study. Get a specific before and after, even if approximate. |
| 8 | **Any other before/after time or cost comparisons?** (slip generation, report creation, manual calculations, etc.) | Stack as many real numbers as possible in the Outcome section. |
| 9 | **What design decisions were made and why?** (tables vs cards, wireframes, color palette, typography, any Figma work?) | Fills the Styling/UX paragraph in the Approach section — this is usually left empty but interviewers and clients always ask. |
| 10 | **What security measures are in place?** | Required in every Approach section — state that the project is well-protected and how. |

> If you are pasting the prompt block below into a project and can answer these up front, write your answers after the bracket fields. The AI will skip asking and go straight to writing.

---

## PROMPT BLOCK (copy everything inside the fence)

```text
You are writing a marketing-grade CASE STUDY for one of my projects. Output a single
Markdown file named `project<name>.md` in the docs/ folder. Do NOT touch any code.

BEFORE WRITING:
1. Read the actual codebase first — README, package.json / config files, source folders,
   any docs/. Never invent features, tech, or numbers. If a feature, stack item, or metric
   is not in the repo, either find it or ask me — do not make it up.
2. Ask me up front for anything you cannot infer from the repo:
   - Is this a CLIENT project or a PASSION project? (If client and I haven't given client
     details, ASK for them before writing — who they are, their business, the pain.)
   - What INDUSTRY is it? (e.g. clothing brand, paper works, government, food, etc.)
   - The TIMELINE, if known.
3. Only after you have the facts, write the case study using the STRUCTURE and RULES below.

WRITE STYLE:
- Clear, easy-to-read sentences. Plain English, market-oriented, confident.
- Show the SOLUTION to a real PROBLEM, and show GROWTH / impact.
- Use REAL NUMERIC VALUES in the outcome, not just pretty statements.

STRUCTURE (use these four sections, in this order):

## 1. Project Overview
- Client / Passion: [say which; if client, name them and their business in one line]
- Industry: [name the sector plainly]
- Timeline: [apply the TIMELINE rule below]
- Development Type: [No-Code / Low-Code / Custom Code — see RULES]
- Platform / Technology: [real frameworks, languages, databases, hosting — from the repo]

## 2. Goal
A short, plain description of what the client/owner wanted to achieve — the problem being solved.

## 3. Our Approach
Tell the THOUGHT PROCESS, not just the result:
- Research: how the client's process actually works, what's painful, what's in the market,
  and how we make this special. (If passion project: show the skills/credibility angle —
  what we can offer, why it's feasible.)
- Decisions + WHY: justify each major tech choice (e.g. "why HTML/vanilla JS over a heavy
  framework", "why Vercel over Wix/GoDaddy", "why this database"). Share the logic.
- Styling / UX approach taken.
- Security: state that the project is well-protected and how.

## 4. Outcome
The final result and business impact, with REAL NUMBERS:
- Features delivered + UI/UX wins.
- Measurable impact — counts, before→after, percentages, time/cost saved.
  Example format only (replace with this project's real figures):
    +5,500% growth on followers reached
    +3,900% growth on non-followers reached
    +14,533% growth on impressions
  Use centralized/numeric proof, not just nice adjectives.
```

---

## RULES (these are baked into the prompt above — reference for me)

### Client vs Passion

- **Client project** → lead with the client's *problem*, the *solution*, and *measurable business growth*. Tone: results and impact.
- **Passion project** → lead with *skills and credibility* — the decisions made, what was offered, why it's feasible. Tone: showcase of capability.
- If it's a client project and the client details are missing, **ask first** — don't guess the business.

### Industry

Name the sector plainly: clothing brand, paper works, government, food service, real estate, etc.

### Timeline (rounding rule)

Round weeks into months plus remainder weeks:

- 2 weeks → **"2 weeks"**
- 4 weeks → **"1 month"**
- 5 weeks → **"1 month and 1 week"**
- 9 weeks → **"2 months and 1 week"**
- Ongoing / no fixed span → say **"Ongoing"**.

### Development Type

- **No-Code** — drag-and-drop builders, no real coding.
- **Low-Code** — beginner platforms / minimal coding to assemble an app.
- **Custom Code** — hand-written code. *This is our default — we do custom code, not low-code.*

### Platform / Technology

List the **real** stack pulled from the repo: languages, frameworks, databases, and hosting (Render, Vercel, Firebase, etc.). No placeholders if the repo tells you the truth.

### Approach — show the thinking

The Approach section must read like a thought process: research → why each decision → styling → security. Always justify *why this tech instead of an alternative* (the logic is the selling point), and always confirm the project is well-secured.

### Outcome — numbers, not adjectives

Use real numeric proof: counts, before→after, percentages, time or cost saved, users served. The `+5,500%` style figures in the prompt are a **format example only** — replace them with the project's real metrics.

---

## The four-section skeleton (quick reference)

```md
## 1. Project Overview
- Client / Passion · Industry · Timeline · Development Type · Platform / Technology

## 2. Goal
- What the client/owner wanted to achieve

## 3. Our Approach
- Research → decisions (why this tech) → styling/UX → security

## 4. Outcome
- Features + UI/UX + measurable impact (REAL numbers)
```

---

## Worked example

See **[`./projectdubaifleamarket.md`](./projectdubaifleamarket.md)** for a complete, real case study
(Dubai Flea Market Intelligence — a 24/7 automated event-monitoring bot) produced with this exact
workflow. Use it as the quality bar for any new write-up.
