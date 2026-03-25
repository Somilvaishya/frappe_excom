---
name: coding-standards
description: Universal code quality standards — naming, structure, DRY, SOLID, documentation. Use when reviewing code quality or establishing patterns.
---

# Coding Standards

## Naming
- Variables/functions: descriptive, no abbreviations. `get_unread_count()` not `get_cnt()`
- Booleans: prefix with `is_`, `has_`, `should_`. `is_active`, `has_unread`
- Constants: UPPER_SNAKE_CASE. `MAX_RETRY_COUNT = 3`
- Files: lowercase with underscores (Python), lowercase with dashes (JS/TS)

## DRY
- If you copy-paste code 3 times, extract a function
- Shared logic between channels → put in `excom/channel/utils.py`
- Shared UI components → `excom/public/js/components/`

## SOLID Basics
- Single Responsibility: one function does one thing
- Open/Closed: channel adapters extend a base, don't modify it
- Dependency Inversion: depend on the adapter interface, not WhatsApp/Gmail directly

## Code Review Checklist
1. Does it handle errors gracefully?
2. Are permissions checked before data access?
3. Is there a test for the main behavior?
4. Would a new team member understand this in 5 minutes?
5. Is there any hardcoded value that should be configurable?

## Documentation
- README.md in each module directory explaining purpose
- Inline comments only for "why", never for "what"
- Complex business logic: add a docstring explaining the rule
