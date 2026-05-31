---
description: Generate an interactive, n8n-styled HTML explainer for a workflow — a faithful canvas with clickable nodes, Simple/Technical explanations, level-aware Key settings, and a stage-by-stage walkthrough.
argument-hint: "[workflow id | name | path/to/file.workflow.ts]  (optional — omit to pick from a list)"
---

# /explain-workflow

Build a self-contained interactive HTML explainer for an n8n workflow and open it in the browser.
The output recreates the n8n canvas (real node icons, real fonts, trigger pill shape, dashed AI
sub-node edges, dot-grid canvas, pan/zoom, resizable panel) and lets the reader click through the
workflow at two difficulty levels.

## Bundled files (resolve the plugin root first)

This command ships two files. Resolve the plugin root before using them:

```bash
echo "$CLAUDE_PLUGIN_ROOT"
```

- **`$CLAUDE_PLUGIN_ROOT/template.html`** — the fixed UI shell. You inject data into it; never rewrite it.
- **`$CLAUDE_PLUGIN_ROOT/DESIGN.md`** — the full design rationale, data schema, content voice
  guidelines, and n8n design-system mapping. **Read it first** and follow it exactly; this command is
  the operational checklist.

## Requirements

- The **n8n MCP server** must be connected in Claude Code (this command calls n8n MCP tools such as
  `search_workflows`, `get_workflow_details`, `get_node_types`). If it isn't, stop and tell the user
  to connect it.
- Optional but recommended: a local clone of the **n8n repo** (commonly `~/Documents/n8n`) so the
  command can read genuine node-icon SVGs for any node type. Without it, common nodes still use a
  built-in icon set and anything else gets a clean generic glyph.

---

## Step 1 — Resolve the target workflow

Look at `$ARGUMENTS`:

- **A file path** (ends in `.ts`, or exists on disk) → treat as a local SDK workflow file. Read it.
- **An id or name** → it's a deployed workflow. Use the n8n MCP:
  - `search_workflows` (query = the name) to resolve the id if a name was given.
  - `get_workflow_details` with the id to get the canonical JSON.
- **Empty** → call `search_workflows` (no/loose query), show the user the matches, and use
  `AskUserQuestion` to let them choose. If a local `*.workflow.ts` is the obvious subject of the
  current session, offer that too.

Prefer the **deployed JSON** when available — it has canonical node names, types, `parameters`,
`position`, `credentials`, and the `connections` graph. Fall back to **parsing the `.ts`** otherwise
(nodes from `trigger()/node()/merge()/languageModel()/...`, names from `config.name`, coords from
`config.position`, params from `config.parameters`, wiring from the `.to()/.input(n)` chain, and any
`sticky()` notes).

> If `get_workflow_details` returns "not available in MCP", tell the user to enable MCP access for
> that workflow (workflow card ⋯ menu, or workflow Settings), then retry.

## Step 2 — Understand every node (use the MCP — do not guess)

1. Collect the distinct node types in the workflow.
2. For each, note the discriminators present in its `parameters` (`resource` / `operation` / `mode`).
3. Call `get_node_types` for all of them **with those discriminators** (use `search_nodes` first if you
   need to discover the right discriminator values). This returns the exact parameter shape — the
   source of truth for the **Key settings** section.

Read the actual parameter **values** from the workflow (cron expression, API query/filters, table
names, model id, recipient, etc.) so the explanations are specific to *this* workflow, not generic.

## Step 3 — Get the real node icons

For each node type, resolve a real icon:

- **If a local n8n repo is available**, read the node's `icon` field from its `*.node.ts`:
  - `icon: 'file:x.svg'` → read that colocated SVG verbatim (full-colour brand icons, e.g. Reddit/Gmail).
  - `icon: 'node:name'` → read
    `packages/frontend/@n8n/design-system/src/components/N8nIcon/nodes/<name>.svg` (monochrome line
    icons that use `currentColor`); resolve `iconColor` to a hex from `_tokens.scss` + `_primitives.scss`.
  - Put the SVG markup in the node's `iconSvg` and the colour in `iconColor`.
- **Otherwise** rely on the template's built-in `NODE_ICONS` map (covers scheduleTrigger, set, reddit,
  httpRequest, merge, filter, dataTable, aggregate, gmail, chainLlm, lmChatAnthropic). Anything not
  covered falls back to a generic glyph automatically — only inject `iconSvg` for types you can source.

## Step 4 — Classify nodes & build the graph

- `kind: "trigger"` for trigger nodes (Schedule, Webhook, Chat Trigger, …) → pill shape + ⚡.
- `kind: "config"` for AI sub-nodes that attach *underneath* a parent: language models
  (`@n8n/n8n-nodes-langchain.lm*`), memory, tools, embeddings, vector stores, output parsers → circle.
  (Note: a standalone vendor node like `@n8n/n8n-nodes-langchain.anthropic` is a normal node, not a
  sub-node — keep it `default`.)
- `kind: "default"` (or omit) otherwise.
- **Edges:** every connection becomes `{from, to}`. For non-`main` connections (a config sub-node into
  its parent) set `ai: true` (rendered dashed, drawn vertically into the parent's bottom).
- **Node ids** must be short, unique, url-safe slugs from the node name (`Write Brief` → `writeBrief`).
  Edges and `stage.nodeIds` reference these ids.

## Step 5 — Normalize positions

Use the workflow's own `[x, y]` coordinates to preserve the author's layout. Translate them so the
top-left node sits near `(40, 80)`; keep relative spacing. Only scale if the spread is extreme — the
canvas auto-fits on load.

## Step 6 — Infer stages

Group nodes into an ordered list of stages along the main flow (sticky notes override the heuristic):

- **Ingestion** — triggers + source fetchers (HTTP/API reads, RSS) and immediate normalizers.
- **Filter & Dedupe / Transform** — merges, filters, IF/Switch, dedupe lookups, field shaping.
- **Enrich / Rank & Write** — aggregation + AI (LLM chains/agents) and their model sub-nodes.
- **Send / Output** — comms (Gmail/Slack/Discord), responses, file writes.
- **Persist / Remember** — Data Table / DB writes that record state.

Name stages for what they *do* here. Every node belongs to exactly one stage; a config sub-node shares
its parent's stage. (For branchy workflows, a fan-out branch can be its own stage.)

## Step 7 — Write the content (the important part)

For **every node**, author the 2×2 matrix + Key settings, following the DESIGN.md voice guidelines:

- `content.simple.whatIs` / `content.technical.whatIs` — what this node *type* is (generic).
- `content.simple.role` / `content.technical.role` — what it does **in this workflow**, specifically
  (cite real field values).
- `cfg: [{ k, v, note: { simple, technical } }]` — the handful of settings someone would actually
  change, each with this workflow's value and a **level-aware** note on what changing it does. Ground
  every entry in the `get_node_types` shape.

Voice: **Simple** = plain, for a capable non-expert — informative, never patronising ("Retrieves posts
from Reddit", not "talks to Reddit"). **Technical** = precise n8n / engineering terms, parameter names,
data shapes, gotchas. Also write `summary.{simple,technical}` and each `stage.summary.{simple,technical}`.

## Step 8 — Assemble, inject, open

1. Build the `WF` object exactly per the DESIGN.md schema (`title`, `summary`, `stages`, `nodes`, `edges`).
   Building it in a small script (e.g. Python) and serializing with a JSON encoder is the safest way to
   handle escaping of the inline SVGs and any `$json` / `$()` expressions in the text.
2. Read `$CLAUDE_PLUGIN_ROOT/template.html`.
3. Replace `__WORKFLOW_DATA__` with the `WF` object as valid JSON, and `__WORKFLOW_TITLE__` with the
   workflow title. Make no other edits to the template. (Guard: the serialized JSON must not contain
   the literal `</script>`.)
4. Write to `./explanations/<workflow-slug>.explain.html` in the user's current project (create
   `explanations/` if needed).
5. Run `open "<path>"` (macOS) / `xdg-open` (Linux) / `start` (Windows) and report the path.

## Quality bar

- Valid JSON injection (no trailing commas; properly escaped strings/quotes/newlines).
- Every node appears on the canvas, in exactly one stage, with full content + cfg.
- Edges reference real node ids; AI sub-node edges marked `ai:true`.
- Explanations are specific and accurate to the real parameters — cross-check a few against
  `get_node_types` and the workflow's actual values before finishing.
