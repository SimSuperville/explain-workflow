# Workflow Explainer for n8n — Claude Code plugin

Turn any n8n workflow into a **self-contained, interactive HTML explainer**: a faithful recreation of
the n8n canvas where anyone can click through the nodes and stages and learn what each one does — at
two difficulty levels (**Simple** / **Technical**), with a top-level overview and a stage-by-stage
walkthrough.

It uses the **real n8n design system** — genuine node icons pulled from the n8n repo, the actual
`InterVariable` + `CommitMono` fonts (embedded), the trigger pill shape, dashed AI sub-node edges, and a
dot-grid canvas you can pan and zoom. Each node's detail panel also shows **Key settings** — the few
parameters worth changing, with this workflow's real values and a plain note on what changing each does.

The output is a single `.html` file with no dependencies — open it in any browser, or share it.

> See a live example: `plugins/explain-workflow/examples/daily-ai-brief.explain.html` (open it in a browser).

---

## Requirements

1. **Claude Code** with plugin support.
2. The **n8n MCP server** connected in Claude Code. This plugin *uses* that server (to read your
   workflow and its node definitions) but cannot provide it — you configure it yourself. See the
   [n8n MCP docs](https://docs.n8n.io/). You'll also need the target workflow to have **MCP access
   enabled** (workflow card ⋯ menu, or workflow Settings).
3. *(Optional, for the richest icons)* a local clone of the [n8n repo](https://github.com/n8n-io/n8n),
   commonly at `~/Documents/n8n`. The command reads genuine node-icon SVGs from it. Without it, common
   nodes still render with a built-in icon set and anything else gets a clean generic glyph.

## Install

```bash
# 1. Add this repository as a plugin marketplace
/plugin marketplace add SimSuperville/explain-workflow
#    (or the full URL: /plugin marketplace add https://github.com/SimSuperville/explain-workflow.git)

# 2. Install the plugin
/plugin install explain-workflow@n8n-tools
```

> The marketplace name (`n8n-tools`) is defined in `.claude-plugin/marketplace.json`, so the install
> id is `explain-workflow@n8n-tools`.

To try it locally before publishing, point the marketplace at a local path:

```bash
/plugin marketplace add /absolute/path/to/explain-workflow-plugin
/plugin install explain-workflow@n8n-tools
```

## Usage

```bash
/explain-workflow                                   # list workflows and pick one
/explain-workflow OSTfxcndi23tMGHH                  # a deployed workflow by id
/explain-workflow "What shipped yesterday — daily digest"   # by name
/explain-workflow path/to/my.workflow.ts            # a local SDK workflow file
```

The plugin writes the result to `./explanations/<workflow-slug>.explain.html` in your current project
and opens it. Click a stage card (or any node) to dive in; use the arrows or ← → to walk the stages;
toggle **Simple / Technical** in the panel; drag the canvas to pan and ⌘/Ctrl-scroll (or pinch) to zoom.

## Updating / removing

```bash
/plugin marketplace update n8n-tools     # pull the latest marketplace + plugin
/plugin uninstall explain-workflow@n8n-tools
```

## How it works / extending it

The plugin is intentionally split into a fixed UI shell plus generated data:

- `plugins/explain-workflow/template.html` — the workflow-agnostic UI (canvas, stepper, panel,
  pan/zoom, embedded fonts). Two placeholders, `__WORKFLOW_DATA__` and `__WORKFLOW_TITLE__`, are
  filled at generation time.
- `plugins/explain-workflow/commands/explain-workflow.md` — the slash command: how the workflow is
  resolved, understood via the n8n MCP, grouped into stages, and turned into the data object.
- **`plugins/explain-workflow/DESIGN.md`** — the full design spec: every product decision, the data
  schema, the content voice guidelines, the n8n design-system mapping, and notes for **building this
  experience natively inside the n8n editor**. Read this if you want to understand or extend the tool.

## License

MIT — see [LICENSE](LICENSE).

The embedded fonts (`InterVariable`, `CommitMono`) and the n8n node icons are distributed under their
own open-source licenses (SIL Open Font License and n8n's license respectively); they remain the
property of their respective owners.
