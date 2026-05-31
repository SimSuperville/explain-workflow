# Workflow Explainer — design & content spec

This folder powers the `/explain-workflow` slash command, which turns any n8n workflow into a
**self-contained interactive HTML explainer**: a faithful recreation of the n8n canvas where a reader
can click through nodes and stages and read what each does, at two difficulty levels.

The slash command (MCP) is the **prototype**. The end goal is to build this experience **natively in
the n8n editor**. This README captures every product + design decision and the content model so that
native build can be done without re-deriving anything.

- `template.html` — the fixed, workflow-agnostic UI shell (canvas, stepper, panel, pan/zoom, fonts).
- `commands/explain-workflow.md` — the command: how Claude resolves a workflow and produces the data.
- `examples/daily-ai-brief.explain.html` — a signed-off reference sample of generated output.
- Generated output is written to `./explanations/<slug>.explain.html` in the user's current project.

---

## 1. Product decisions (locked with the user)

| Decision | Choice | Notes |
|---|---|---|
| **Difficulty levels** | **2 — Simple / Technical** | A toggle in the panel. Swaps node descriptions, stage summaries, the overview, *and* the Key-settings notes simultaneously. Persists across navigation. |
| **Top-level overview** | **Step 0 of the walkthrough** | The bottom stepper opens on an Overview step: whole-workflow summary + a card per stage. |
| **Stepping model** | **Hybrid** | Prev/Next walks *stages*; a stage expands to its nodes (node chips, or click a node on canvas). In a node, Prev/Next walks the nodes *within that stage*; breadcrumb (Overview › Stage › Node) jumps back. |
| **Input / data source** | **Auto-detect** | Accepts a deployed workflow id/name (canonical JSON via `get_workflow_details`), a local `.workflow.ts` path (parse the SDK), or nothing (list + pick). |
| **Layout** | Canvas on top, **resizable** detail panel docked at the bottom | Drag the bar at the top of the panel (150px → 72vh). |
| **Node visuals** | **Real n8n SVG icons**, rendered directly on the white node box (no tiles/emoji) | Brand icons in colour (Reddit, Gmail, Anthropic); line icons (`node:`) tinted with their `iconColor`. |
| **Typography** | **Real n8n fonts embedded** | `InterVariable` (UI) + `CommitMono` (mono), base64 `@font-face`, SIL OFL. Self-contained — renders identically anywhere. |
| **Canvas interaction** | **Pan + zoom**, not scroll | Drag to pan; two-finger scroll pans; ⌘/Ctrl-scroll or trackpad pinch zooms toward the cursor; zoom controls + fit button bottom-left. Auto-fits on load and re-frames per stage/node. |
| **Overview ↔ canvas link** | **Hover a stage card → highlight its nodes** on the canvas; click → step in. | Selected/stage nodes get an orange ring; others dim; in-stage edges light up. |
| **Node detail** | Two columns: explanation (What it is / Its role here) + **Key settings** | "Key settings" = the few params worth changing, with this workflow's value and a level-aware note on what changing it does. Grounded in `get_node_types`. |
| **Trigger nodes** | Pill-rounded left edge + ⚡ badge | Matches the n8n canvas. |
| **AI sub-nodes** | Circular ("config" kind), connected into the parent **from below** with a **dashed** edge | Matches n8n's model/memory/tool attachment convention. |

### Voice guidelines (apply consistently)

- **Simple** — for a capable, non-expert reader. Plain and informative, **never patronising**. Say
  "Retrieves posts from Reddit", not "talks to Reddit". No "little database", no "AI brain". Be
  specific about what the node does *here* (e.g. "Pulls the top posts of the day from each AI subreddit
  in the list — up to 100 per community").
- **Technical** — precise engineering / n8n language: parameter names, discriminators (`post:getAll`),
  data shapes (`{source,title,url,summary,published_at}`), gotchas ("Filter has no false output —
  non-matching items are dropped").
- **`whatIs` vs `role`** — `whatIs` explains the node *type* generically; `role` explains its specific
  job in *this* workflow, citing real configured values.
- **Key settings notes** are level-aware too: Simple explains the *effect* of changing it; Technical
  names the parameter and constraints.

---

## 2. Architecture

The template **never changes per workflow**. Claude (or, natively, the editor) supplies only a JSON
**data object**; the template renders it. Two placeholders are substituted:

- `__WORKFLOW_DATA__` → the `WF` JSON object (schema below).
- `__WORKFLOW_TITLE__` → the workflow title (in the `<title>` tag).

Everything interactive — canvas render, edges, pan/zoom, stepper, Simple/Technical toggle, hover
highlight, theme toggle, panel resize — is vanilla JS inside the template. No build step, no network,
no server.

Why the split: it keeps generation cheap and consistent, and makes the native n8n port a matter of
feeding the same data shape from the workflow store into an in-app panel.

---

## 3. Data schema (`WF`)

```jsonc
{
  "title": "Daily AI Brief",
  "summary": { "simple": "…", "technical": "…" },

  "stages": [
    {
      "id": "ingest",                       // url-safe slug, unique
      "name": "Ingestion",                  // shown in stepper + overview card
      "nodeIds": ["trigger", "listSubs"],   // order = walkthrough order within the stage
      "summary": { "simple": "…", "technical": "…" }
    }
  ],

  "nodes": [
    {
      "id": "trigger",                      // unique slug; referenced by edges + stage.nodeIds
      "name": "Daily 06:55",                // canvas label (the node's display name)
      "type": "n8n-nodes-base.scheduleTrigger",
      "kind": "trigger",                    // "trigger" | "config" | "default" (omit = default)
      "x": 40, "y": 248,                    // canvas coords (author layout, offset so min ~ 40,80)
      "stage": "ingest",                    // the stage this node belongs to

      "iconSvg": "<svg…>…</svg>",           // OPTIONAL: real icon markup (omit to use built-in map → generic)
      "iconColor": "#424242",               // OPTIONAL: tint for currentColor (line) icons

      "content": {
        "simple":    { "whatIs": "…", "role": "…" },
        "technical": { "whatIs": "…", "role": "…" }
      },

      "cfg": [                              // "Key settings" — the params worth changing
        { "k": "Cron expression", "v": "0 55 6 * * *",
          "note": { "simple": "This is the 06:55 schedule…", "technical": "Fields are [sec min hour …]" } }
      ]
    }
  ],

  "edges": [
    { "from": "trigger", "to": "listSubs" },
    { "from": "claude",  "to": "writeBrief", "ai": true }   // ai:true → dashed, vertical into parent
  ]
}
```

Notes:
- `kind:"config"` nodes (AI language models, memory, tools, embeddings, vector stores, output parsers)
  render as a circle and have no input/output handle dots.
- `ai:true` edges represent non-`main` connections (a config sub-node feeding its parent).
- `cfg[].note` may also be a plain string (used for both levels), but prefer `{simple, technical}`.
- Every node must appear in exactly one `stage.nodeIds` and carry full `content` + `cfg`.

---

## 4. n8n design-system mapping

Sourced from the n8n repo (`packages/frontend/@n8n/design-system` + `editor-ui/.../canvas`):

| Element | Value used in the template |
|---|---|
| Brand orange | `#ff6912` (hover `#f54b26`) — `--color--orange-500` |
| UI font | **InterVariable** (weights 100–900), embedded woff2 |
| Mono font | **CommitMono**, embedded woff2 |
| Node box | 84px square (n8n ships 96; 84 reads well at this scale), `border-radius: 8px` (`--radius--lg`), 1.5px subtle border, white bg |
| Trigger node | `border-radius: 30px 8px 8px 30px` + ⚡ badge to the left |
| Config (AI) node | circle, 64px |
| Canvas | light `#f0f0f2` / dark `#161618`, 16px radial **dot grid** |
| Connections | SVG bezier, ~2px neutral stroke (`#bcbcc4`); AI/sub connections `stroke-dasharray: 5 6` |
| Handles | 9px white dots with grey border on node left (in) / right (out) |
| Detail panel | bottom-docked, resizable; NDV-flavoured node header (icon + name + mono type) |
| Icon sizing | 40px on canvas nodes, 30px on config nodes & panel header |

**Icon sourcing** (the faithful part): n8n node icons live either as colocated brand SVGs
(`packages/nodes-base/nodes/.../x.svg`, e.g. Reddit, Gmail; langchain under
`packages/@n8n/nodes-langchain/nodes/.../x.svg`) referenced by `icon: 'file:x.svg'`, or as monochrome
registry icons referenced by `icon: 'node:name'` in
`packages/frontend/@n8n/design-system/src/components/N8nIcon/nodes/<name>.svg` (these use
`currentColor`, tinted by the node's `iconColor`). `iconColor` names resolve to hex via `_tokens.scss`
→ `_primitives.scss`. The template embeds the 11 common ones; the command injects others as `iconSvg`
when a local n8n repo is available, else a generic glyph is used.

---

## 5. Stage inference heuristic

Order stages along the main flow. Default buckets (adapt per workflow; sticky notes override):

1. **Ingestion** — triggers + source fetchers (HTTP/API reads, RSS) + immediate normalizers.
2. **Filter & Dedupe / Transform** — merges, filters, IF/Switch, dedupe lookups, field shaping.
3. **Enrich / Rank & Write** — aggregation + AI (LLM chains/agents) and their model sub-nodes.
4. **Send / Output** — comms (Gmail/Slack/Discord), webhook responses, file writes.
5. **Persist / Remember** — Data Table / DB writes that record state for next time.

Name each stage for what it actually does. A config sub-node shares its parent's stage.

---

## 6. Building this natively in n8n (handoff notes)

This prototype deliberately mirrors the editor so the native version is mostly a data + placement job:

- **Data** is already in the workflow store (nodes, `parameters`, `position`, `connections`) and the
  node-type registry (`NodeTypesStore`) — no MCP needed in-app. The `WF` schema above maps directly.
- **Icons & fonts** already ship in the app (`NodeIcon` / `N8nNodeIcon`, InterVariable, CommitMono) —
  reuse them instead of embedding.
- **Canvas**: either reuse the real Vue Flow canvas in a read-only "explain mode" overlay, or a
  lightweight static render like this template. The static render is simpler for an embedded panel /
  share link; the live canvas gives perfect fidelity.
- **Detail panel**: reuse NDV styling/components; add the Simple/Technical toggle and the Key-settings
  list (derive defaults + descriptions from the node type's `properties`).
- **The genuinely new asset is the content model** — the Simple/Technical × whatIs/role matrix, the
  stage grouping, and the level-aware Key-settings notes. That's what an LLM generates; the rest is UI
  the app already has. Persist generated content with the workflow so it isn't regenerated each view.

---

## 7. Known limitations / future

- Real icons for *arbitrary* node types depend on a local n8n repo being present; otherwise common
  nodes use the built-in map and the rest fall back to a generic glyph. (In-app this is solved — the
  registry has every icon.)
- Sticky notes aren't rendered yet (used only as stage hints). Worth showing as canvas annotations.
- Key settings summarize the important params; they don't yet show every parameter or live expression
  values. A "show full config" expander is a natural addition.
- No minimap. Fine at current scale; add for very large workflows.
