# Changelog

All notable changes to the **Workflow Explainer for n8n** plugin.

## [1.1.0]

### Fixed
- **Blank canvas.** The template injected data as an inline JS object literal and rendered edges
  before nodes with no error handling, so any single fault (a special character in node text, one edge
  pointing at a missing node, a layout NaN) silently blanked the whole page. Data is now injected as
  `<script type="application/json">` and parsed at runtime; `boot()` validates the data, renders nodes
  before edges, skips/​warns on bad references, and shows a visible **error overlay** instead of a blank
  page if anything is still wrong.

### Changed
- **No local n8n repo required.** ~100 real node icons now ship inside the plugin
  (`node-icons.json`); icons are matched on node type with a generic-glyph fallback. The command no
  longer reads `~/Documents/n8n`.
- **One-command build.** A bundled Node builder (`build.mjs`) injects the data + icons into the
  template and opens the result. A full run is now ~2 MCP reads + 1 file write + 1 `node` call, down
  from ~14 shell operations — far fewer permission prompts.
- Command rewritten accordingly (Step 3 icons → nothing to do; Step 8 → write `.wf.json` + run
  `build.mjs`). Requirements now list **Node.js ≥ 18** and drop the optional repo.

### Added
- `node-icons.json` (bundled icon library) and `build.mjs` (builder).
- A regenerated bundled example: `examples/what-shipped-yesterday.explain.html`.

## [1.0.0]

- Initial release: `/explain-workflow` slash command, fixed `template.html` shell with embedded n8n
  fonts and real node icons, `DESIGN.md` spec, and marketplace packaging.
