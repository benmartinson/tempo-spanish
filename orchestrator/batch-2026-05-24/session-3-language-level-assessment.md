# Session 3 Brief - Language Level Assessment UI

You are one of several parallel coding sessions. You are not alone in this repo. Work only in your assigned worktree/branch, do not touch other sessions' branches, and do not revert edits you did not make.

## Worktree Setup

From `/Users/benmartinson/workspace/tempo-mobile`:

```bash
git fetch origin main
git worktree add -b codex/language-level-assessment /tmp/tempo-mobile-level-assessment main
cd /tmp/tempo-mobile-level-assessment
npm install
```

Shared status file to update when done:

`/Users/benmartinson/workspace/tempo-mobile/orchestrator/batch-2026-05-24/status.md`

## Task

Add a UI section inside Writing Studio that estimates the user's current Spanish level.

Starting product idea from the user:

- Show passages in a UI format similar to `src/components/writing-studio/FindVideoMatch.tsx` results.
- Ask whether the user can understand the passage.
- Be creative; this is a starting point, not a rigid spec.

The result should help guide learning later. Keep the design concrete and shippable rather than building a huge assessment system.

## Implementation Guidance

- Put the entry point in Writing Studio. The user answered "Yes" to that location.
- Reuse visual language from `FindVideoMatch` result cards: title/meta/excerpt/action feel.
- Use Spanish-only behavior for now.
- Use existing Supabase access patterns from `src/requests.ts`, `utils/supabase.ts`, and Writing Studio components.
- If persistence needs a table that may not exist yet, add request helpers that fail gracefully and keep local UI state usable. Do not add migrations.
- Suggested flow:
  - Present 3-5 passage cards across existing difficulty labels.
  - Let the user respond with "Comfortable", "Some gaps", "Too hard" or similarly compact controls.
  - Compute a simple estimated level/difficulty band.
  - Save that signal if a suitable table exists or can be used safely; otherwise document the expected table in Notes and keep the app functional.
- Avoid changing the core `FindVideoMatch` matching logic unless necessary.

## Acceptance Criteria

- Writing Studio has a reachable level assessment section.
- Users can evaluate several Spanish passages.
- The UI produces a visible estimated level or starting point.
- The implementation does not block guest/unauthenticated use.
- Supabase failures do not break the assessment UI.
- The feature is ready for Session 4 to consume or integrate with.

## Pre-flight Self-check Before Marking Done

Run:

```bash
git diff --stat main..HEAD
git diff --name-only main..HEAD
npm test -- --runInBand
```

If feasible, run the app/web build check used in this repo:

```bash
npm run build:web
```

Then:

1. Compare the diff against the files you claim shipped.
2. Verify every imported module or referenced path is either in your diff or already on main.
3. If a file is missing, recover it before claiming done.
4. In the shared status Notes, list side effects outside git: Supabase writes, npm installs, env changes, generated files, expected-but-missing tables, etc.
5. Update only the Session 3 block in the shared status file.

Do not ask mid-build. Make reasonable calls and leave clear Notes for the orchestrator.
