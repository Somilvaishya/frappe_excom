#!/usr/bin/env python3
"""graphify generator — excom codebase -> Obsidian graph vault.
Deterministic & idempotent: wipes and rebuilds the notes, keeps .obsidian user files.
"""
import ast
import glob
import json
import os
import re
import shutil

APP = "excom/excom"
VAULT = "graph-vault"
LINK_TYPES = {"Link", "Table", "Table MultiSelect"}

# ---------------------------------------------------------------- helpers
def rgb(hexstr):
    return int(hexstr, 16)

def fm(props):
    lines = ["---"]
    for k, v in props.items():
        if isinstance(v, list):
            lines.append(f"{k}: [{', '.join(v)}]")
        elif isinstance(v, bool):
            lines.append(f"{k}: {str(v).lower()}")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines)

def write_note(folder, name, props, body):
    d = os.path.join(VAULT, folder)
    os.makedirs(d, exist_ok=True)
    safe = name.replace("/", "-")
    with open(os.path.join(d, safe + ".md"), "w") as f:
        f.write(fm(props) + "\n\n" + body.strip() + "\n")

# ---------------------------------------------------------------- 1. doctypes
doctypes = {}          # display name -> info
for jf in glob.glob(f"{APP}/doctype/*/*.json"):
    if os.path.basename(jf) != os.path.basename(os.path.dirname(jf)) + ".json":
        continue
    d = json.load(open(jf))
    if d.get("doctype") != "DocType":
        continue
    name = d.get("name")
    edges = []
    for fld in d.get("fields", []):
        if fld.get("fieldtype") in LINK_TYPES and fld.get("options"):
            edges.append((fld.get("fieldname"), fld.get("fieldtype"), fld["options"]))
    doctypes[name] = {
        "istable": bool(d.get("istable")),
        "issingle": bool(d.get("issingle")),
        "module": d.get("module", "Excom"),
        "edges": edges,
        "path": jf,
        "pypath": jf[:-5] + ".py",
        "nfields": len(d.get("fields", [])),
    }
internal = set(doctypes)

# ---------------------------------------------------------------- 2. code modules
MODULES = {
    "Channels": f"{APP}/channels",
    "Services": f"{APP}/services",
    "Tasks":    f"{APP}/tasks",
    "Scheduler":f"{APP}/scheduler",
    "Utils":    f"{APP}/utils",
    "Reports":  f"{APP}/report",
    "API":      f"{APP}/api",
}

def doctypes_referenced(text):
    hits = set()
    for dn in internal:
        if f'"{dn}"' in text or f"'{dn}'" in text:
            hits.add(dn)
    return hits

module_refs = {}   # module -> set(doctypes)
for mod, path in MODULES.items():
    refs = set()
    for py in glob.glob(os.path.join(path, "**/*.py"), recursive=True):
        try:
            refs |= doctypes_referenced(open(py, encoding="utf-8", errors="ignore").read())
        except OSError:
            pass
    module_refs[mod] = refs

# doctype -> modules that reference it
dt_modules = {dn: [m for m, refs in module_refs.items() if dn in refs] for dn in internal}

# ---------------------------------------------------------------- 3. whitelisted API endpoints
api_eps = []   # (funcname, relpath, set(doctypes), module_label)
for py in glob.glob(f"{APP}/**/*.py", recursive=True):
    if "/doctype/" in py:
        continue
    try:
        src = open(py, encoding="utf-8", errors="ignore").read()
        tree = ast.parse(src)
    except (OSError, SyntaxError):
        continue
    lines = src.splitlines(keepends=True)
    offs, tot = [], 0
    for ln in lines:
        offs.append(tot); tot += len(ln)
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        if not any(
            (isinstance(d, ast.Name) and d.id == "whitelist")
            or (isinstance(d, ast.Attribute) and d.attr == "whitelist")
            or (isinstance(d, ast.Call) and (
                (isinstance(d.func, ast.Attribute) and d.func.attr == "whitelist")))
            for d in node.decorator_list
        ):
            continue
        start = offs[node.lineno - 1]
        end = offs[node.end_lineno - 1] + len(lines[node.end_lineno - 1]) if node.end_lineno <= len(lines) else tot
        seg = src[start:end]
        # owning module label from path (connects API notes to the module layer)
        mlabel = "API"
        for m, mp in MODULES.items():
            if py.startswith(mp + "/"):
                mlabel = m
                break
        api_eps.append((node.name, py, doctypes_referenced(seg), mlabel))

# disambiguate colliding endpoint names (skill rule: no silent collapse)
import collections as _c
_names = _c.Counter(fn for fn, *_ in api_eps)
api_notes = []   # (display_name, py, refs, mlabel)
for fn, py, refs, mlabel in api_eps:
    stem = os.path.splitext(os.path.basename(py))[0]
    disp = f"API — {fn}" if _names[fn] == 1 else f"API — {fn} ({stem})"
    api_notes.append((disp, py, refs, mlabel))

# ---------------------------------------------------------------- 4. hooks
DOC_EVENT_TARGETS = ["Customer", "Supplier", "Lead", "Contact", "Party Link"]
SCHED = {
    "all": ["process_pending_whatsapp_notification_logs", "trigger_whatsapp_notifications_all",
            "poll_all_email_accounts", "process_due_scheduled_broadcasts", "check_stale_messages"],
    "hourly": ["trigger_whatsapp_notifications_hourly", "trigger_whatsapp_notifications_hourly_long"],
    "daily": ["trigger_whatsapp_notifications_daily", "cleanup_stale_identities",
              "scan_merge_suggestions", "check_token_expiry"],
    "weekly": ["trigger_whatsapp_notifications_weekly"],
    "monthly": ["trigger_whatsapp_notifications_monthly"],
    "daily_maintenance": ["sync_invalid_tokens"],
}

# ---------------------------------------------------------------- wipe & rebuild notes (keep .obsidian)
if os.path.isdir(VAULT):
    for entry in os.listdir(VAULT):
        if entry == ".obsidian":
            continue
        p = os.path.join(VAULT, entry)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
os.makedirs(VAULT, exist_ok=True)

edge_count = 0

# ---- doctype notes
for name, info in sorted(doctypes.items()):
    tags = ["doctype"]
    if info["istable"]: tags.append("childtable")
    if info["issingle"]: tags.append("single")
    body = [f"# {name}", ""]
    kind = "Child table" if info["istable"] else ("Single" if info["issingle"] else "Doctype")
    body.append(f"{kind} · {info['nfields']} fields · source `{info['pypath']}`")
    body.append("")
    body.append("## Links to")
    if info["edges"]:
        for fn, ft, opt in info["edges"]:
            edge_count += 1
            tag = "child" if ft in ("Table", "Table MultiSelect") else "link"
            body.append(f"- `{fn}` ({tag}) → [[{opt}]]")
    else:
        body.append("- _(no link/table fields)_")
    if dt_modules[name]:
        body.append("")
        body.append("## Touched by")
        for m in dt_modules[name]:
            edge_count += 1
            body.append(f"- [[{m}]]")
    props = {
        "type": "doctype",
        "tags": tags,
        "module": info["module"],
        "istable": info["istable"],
        "issingle": info["issingle"],
        "source": info["pypath"],
    }
    write_note("Doctypes", name, props, "\n".join(body))

# ---- module notes
for mod, path in MODULES.items():
    refs = sorted(module_refs[mod])
    body = [f"# {mod}", "", f"Code module · `{path}`", "", "## References doctypes"]
    if refs:
        for dn in refs:
            edge_count += 1
            body.append(f"- [[{dn}]]")
    else:
        body.append("- _(no direct doctype references)_")
    write_note("Modules", mod, {"type": "module", "tags": ["module"], "source": path}, "\n".join(body))

# ---- API endpoint notes
for disp, py, refs, mlabel in sorted(api_notes):
    body = [f"# {disp}", "", f"Whitelisted endpoint · `{py}`", "",
            f"**Module** → [[{mlabel}]]"]
    edge_count += 1
    if refs:
        body += ["", "## Operates on"]
        for dn in sorted(refs):
            edge_count += 1
            body.append(f"- [[{dn}]]")
    write_note("API", disp, {"type": "api", "tags": ["api"], "module": mlabel, "source": py}, "\n".join(body))

# ---- hooks: Doc Events
body = ["# Doc Events", "", "`hooks.py` `doc_events` wiring.", "",
        "## Global (`*`)", "- validate / on_update / after_insert / on_submit → server scripts + identity rules",
        "", "## Per-doctype after_insert → identity resolution"]
for t in DOC_EVENT_TARGETS:
    body.append(f"- [[{t}]]")  # external → faded node
body.append("")
body.append("Handled by [[Services]] (`identity_hooks`).")
edge_count += len(DOC_EVENT_TARGETS) + 1
write_note("Hooks", "Doc Events", {"type": "hook", "tags": ["hook", "doc_events"], "source": f"{APP.split('/')[0]}/hooks.py"}, "\n".join(body))

# ---- scheduler tasks
for bucket, funcs in SCHED.items():
    body = [f"# Scheduler — {bucket}", "", f"`scheduler_events['{bucket}']`", "", "## Runs"]
    for fn in funcs:
        body.append(f"- `{fn}`")
    body += ["", "Implemented in [[Utils]] / [[Services]] / [[Tasks]] / [[Scheduler]]."]
    edge_count += 4
    write_note("Tasks", f"Scheduler — {bucket}", {"type": "task", "tags": ["task", "scheduler"], "source": f"{APP.split('/')[0]}/hooks.py"}, "\n".join(body))

# ---------------------------------------------------------------- 5. graph.json
graph = {
    "collapse-filter": True, "search": "", "showTags": True, "showAttachments": False,
    "hideUnresolved": False, "showOrphans": True, "collapse-color-groups": False,
    "colorGroups": [
        {"query": "path:Doctypes/", "color": {"a": 1, "rgb": rgb("52DDD2")}},
        {"query": "path:Modules/",  "color": {"a": 1, "rgb": rgb("E06C4B")}},
        {"query": "path:API/",      "color": {"a": 1, "rgb": rgb("52B6E0")}},
        {"query": "path:Hooks/",    "color": {"a": 1, "rgb": rgb("E3B341")}},
        {"query": "path:Tasks/",    "color": {"a": 1, "rgb": rgb("9B7EDE")}},
        {"query": "tag:#childtable","color": {"a": 1, "rgb": rgb("7A8A99")}},
    ],
    "collapse-display": False, "showArrow": True, "textFadeMultiplier": -0.3,
    "nodeSizeMultiplier": 1.15, "lineSizeMultiplier": 1, "collapse-forces": False,
    "centerStrength": 0.52, "repelStrength": 12, "linkStrength": 1,
    "linkDistance": 250, "scale": 1, "close": True,
}
os.makedirs(os.path.join(VAULT, ".obsidian"), exist_ok=True)
json.dump(graph, open(os.path.join(VAULT, ".obsidian", "graph.json"), "w"), indent=2)

# ---------------------------------------------------------------- 6. index.md
n_dt = len(doctypes); n_child = sum(1 for i in doctypes.values() if i["istable"])
idx = ["---", "type: index", "tags: [index, moc]", "---", "", "# Excom — Architecture Graph", "",
       "Map of content. Open this vault in Obsidian → **graph view** (Ctrl/Cmd-G).", "",
       "## Modules", ""]
for m in MODULES: idx.append(f"- [[{m}]]")
idx += ["", "## Hooks & schedule", "- [[Doc Events]]"]
for b in SCHED: idx.append(f"- [[Scheduler — {b}]]")
idx += ["", "## Counts",
        f"- Doctypes: **{n_dt}** ({n_child} child tables)",
        f"- API endpoints: **{len(api_eps)}**",
        f"- Modules: **{len(MODULES)}**", ""]
idx += ["## Doctypes", ""]
for dn in sorted(doctypes): idx.append(f"- [[{dn}]]")
open(os.path.join(VAULT, "index.md"), "w").write("\n".join(idx) + "\n")

# ---------------------------------------------------------------- 7. verify
note_files = glob.glob(f"{VAULT}/**/*.md", recursive=True)
note_names = {os.path.basename(f)[:-3] for f in note_files}
broken = {}
orphan_candidates = set(note_names)
link_re = re.compile(r"\[\[([^\]|]+)")
referenced = set()
for f in note_files:
    txt = open(f).read()
    for m in link_re.findall(txt):
        referenced.add(m)
# broken = links whose target is neither a note nor a known external doctype
EXTERNAL_OK = {"User", "DocType", "Customer", "Supplier", "Lead", "Contact", "Party Link", "WhatsApp Templates"}
external = set()
for f in note_files:
    for m in link_re.findall(open(f).read()):
        if m not in note_names:
            external.add(m)

print(f"notes written : {len(note_files)}")
print(f"  doctypes    : {n_dt}")
print(f"  api         : {len(api_eps)}")
print(f"  modules     : {len(MODULES)}")
print(f"  hooks/tasks : {1 + len(SCHED)}")
print(f"edges (links) : ~{edge_count}")
print(f"external (faded) node targets: {len(external)} -> {sorted(external)}")
print(f"vault: {os.path.abspath(VAULT)}")
