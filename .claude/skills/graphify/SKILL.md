---
name: graphify
description: >-
  Turn a codebase into a navigable Obsidian graph vault — one markdown note per
  architectural entity (module, doctype, controller, API endpoint, hook,
  scheduler task, channel/service, report, patch, frontend component), wired
  together with [[wikilinks]] so Obsidian's graph view renders the architecture.
  Use when the user asks to "graphify", visualize/map a repo's architecture as an
  Obsidian vault, or produce an interlinked knowledge graph of the code. Tuned for
  Frappe/ERPNext apps (doctypes, hooks.py, Link fields) with a generic fallback.
---

# graphify — codebase → Obsidian graph vault

Produce an **Obsidian vault**: a folder of `.md` notes where every meaningful
code entity is one note, and real dependencies between them are `[[wikilinks]]`.
Opening the folder in Obsidian shows the architecture as a force-directed graph
you can pan, color by type, and explore locally.

The value is entirely in the **edges**. A pile of notes with no links is a dead
graph. Spend your effort extracting genuine relationships (below), not prose.

## 0. Scope & output location

Resolve these before doing anything, from the user's args or sensible defaults:

- **Target**: which app/dir to graph. Default = the app the skill lives in
  (e.g. `excom/excom/`). Accept a path arg to scope tighter (one module).
- **Output vault dir**: default `./graph-vault/` at the repo root. Never write
  notes into source folders. If the dir exists, treat this as a **regenerate**
  (see §7 idempotency) — don't blindly append.
- Add the vault dir to `.gitignore` unless the user says to commit it.

Announce the target and output path, then proceed — don't stall on confirmation
for a read-only extraction that writes to a fresh folder.

## 1. Inventory the codebase (extraction)

Mine entities with search tools, not guesswork. For a **Frappe app**:

| Entity | How to find it | Note folder |
|---|---|---|
| Module | top-level dirs under `<app>/<app>/` (`channels`, `services`, `api`, …) | `Modules/` |
| Doctype | `*/doctype/<name>/<name>.json` | `Doctypes/` |
| Controller | the sibling `<name>.py` (class methods, `on_*`/`validate` hooks) | folded into the Doctype note |
| API endpoint | functions decorated `@frappe.whitelist()` (grep it) | `API/` |
| Hook wiring | `hooks.py`: `doc_events`, `scheduler_events`, `override_*`, `fixtures` | `Hooks/` (one note per hook group) |
| Scheduler task | targets of `scheduler_events` + `tasks/` funcs | `Tasks/` |
| Channel/Service | `channels/*`, `services/*` | `Services/` |
| Report | `*/report/<name>/` | `Reports/` |
| Patch | `patches/*` + `patches.txt` entries | `Patches/` |
| Frontend | `frontend/src` components, `public/js` bundles | `Frontend/` |

For **doctypes**, parse the JSON and capture: `module`, `istable` (child table?),
`issingle`, each field's `fieldtype`/`options`, and especially **`Link` and
`Table` field `options`** — those name other doctypes and are your strongest edges.

**Generic (non-Frappe) fallback**: nodes = files/modules/classes/exported
symbols; edges = imports/requires, calls, inheritance, route→handler. Use the
same note/link machinery below.

Cap the run sensibly and `log` what you skipped — a graph that silently drops
half the doctypes reads as complete when it isn't.

## 2. One note per entity

- **Filename = the entity's display name** (`Excom Thread.md`, not a slug) so
  wikilinks read naturally and Obsidian auto-completes them.
- Keep names **globally unique** across folders (Obsidian links are by name, not
  path). Prefix on collision (`API — send_message.md`).
- One entity per file. Don't merge two doctypes into one note.

## 3. Edge rules — the important part

Emit a `[[link]]` for every **real** relationship. Minimum edge set:

- **Doctype → Module**: every doctype links its owning module.
- **Doctype → Doctype** (the backbone): each `Link` field → `[[Target Doctype]]`;
  each child `Table` field → `[[Child Doctype]]`, and the child links back to its
  parent. This is what makes the graph informative — don't skip it.
- **Controller → Hook**: if `hooks.py` `doc_events` binds a doctype's
  `on_update`/`validate`/etc., link the Doctype note ↔ the `[[Doc Events]]` note.
- **API → Doctype**: a whitelisted function that reads/writes `Excom Message`
  links `[[Excom Message]]`.
- **Task → Doctype/Service** it operates on; **Task ← Scheduler** hook.
- **Service/Channel → Doctype** it persists to (e.g. WhatsApp channel →
  `[[Excom Message]]`, `[[Omni Identity]]`).
- **Patch → Doctype** it alters.

Prefer a few dozen accurate edges over hundreds of speculative ones. If you're
unsure a relationship exists, open the file and confirm rather than inventing it.

## 4. Note template

Every note starts with YAML frontmatter (Obsidian "properties") then a short body.
`type` and `tags` drive graph coloring; the `source` path is a clickable pointer
back to code.

```markdown
---
type: doctype            # module | doctype | api | hook | task | service | report | patch | frontend
tags: [doctype, channel]
source: excom/excom/doctype/excom_message/excom_message.py
module: "[[Channels]]"
istable: false
---

# Excom Message

One-line purpose (what this entity is).

## Links to
- **Belongs to** [[Channels]]
- **Thread** → [[Excom Thread]]        <!-- Link field `thread` -->
- **Sender** → [[Omni Identity]]       <!-- Link field `sender` -->

## Touched by
- [[Doc Events]] (`on_update` → notify)
- [[API — send_message]]

## Notes
Key fields, gotchas — one or two lines, not a doc dump.
```

Put every relationship inside the body as a real `[[link]]` (frontmatter links
also count as edges in Obsidian, but body links are easier to read/verify).

## 5. `.obsidian/graph.json` — color the graph by type

Write `<vault>/.obsidian/graph.json` so the graph opens pre-colored by entity
type via search-query color groups. Template:

```json
{
  "collapse-filter": true,
  "search": "",
  "showTags": true,
  "showAttachments": false,
  "hideUnresolved": false,
  "showOrphans": true,
  "collapse-color-groups": false,
  "colorGroups": [
    { "query": "path:Doctypes/",  "color": { "a": 1, "rgb": 5431378  } },
    { "query": "path:Modules/",   "color": { "a": 1, "rgb": 14701138 } },
    { "query": "path:API/",       "color": { "a": 1, "rgb": 5419488  } },
    { "query": "path:Hooks/",     "color": { "a": 1, "rgb": 14913095 } },
    { "query": "path:Tasks/",     "color": { "a": 1, "rgb": 9737471  } },
    { "query": "path:Services/",  "color": { "a": 1, "rgb": 16007990 } },
    { "query": "path:Patches/",   "color": { "a": 1, "rgb": 10233776 } }
  ],
  "collapse-display": false,
  "showArrow": true,
  "textFadeMultiplier": 0,
  "nodeSizeMultiplier": 1.1,
  "lineSizeMultiplier": 1,
  "collapse-forces": false,
  "centerStrength": 0.52,
  "repelStrength": 12,
  "linkStrength": 1,
  "linkDistance": 260,
  "scale": 1
}
```

`rgb` is a decimal-encoded 0xRRGGBB (e.g. `5431378` = `#52DDD2`). Adjust queries
to the folders you actually created. Modules get bigger nodes naturally because
many doctypes link to them.

## 6. Index / Map of Content + layout

Final vault layout:

```
graph-vault/
  .obsidian/graph.json
  index.md                 # MOC: links to each module + counts
  Modules/  Doctypes/  API/  Hooks/  Tasks/  Services/  Reports/  Patches/  Frontend/
```

`index.md` is the entry hub — link every Module note and give per-type counts so
the user has one node that reaches everything (kills orphan islands).

## 7. Idempotency, verify, hand off

- **Regenerate cleanly**: on a re-run, rewrite the vault deterministically. Don't
  leave stale notes for deleted doctypes — diff against the current inventory and
  drop removed ones. Never touch `.obsidian/` user tweaks beyond `graph.json`
  unless asked.
- **Verify before declaring done**: count notes vs. entities found; grep the vault
  for `[[...]]` targets that have no matching file (broken links / typos) and fix
  or report them. Report orphan notes (no in/out links) — usually a missed edge.
- **Report**: entity counts by type, edge count, output path, and the one line the
  user needs: *open the `graph-vault/` folder as a vault in Obsidian → open graph
  view.* State honestly what you skipped or couldn't resolve.

## Appendix — Obsidian cheat-sheet

- A **vault is just a folder** of `.md`; no import step. "Open folder as vault".
- **Edges** come from `[[Note]]` / `[[Note|alias]]` links and from list-type
  frontmatter properties — **not** from folder nesting. Folders never link.
- `#tags` and frontmatter `tags:` become tag-nodes when *Show tags* is on.
- **Global graph**: whole vault. **Local graph**: neighborhood of the open note —
  best for "what touches this doctype?".
- Color/group nodes via `graph.json` `colorGroups` search queries
  (`path:`, `tag:`, `file:`, plain text).
- Unresolved `[[link]]` (no target file) shows as a faded node — handy on purpose,
  noise by accident. Keep them intentional.
