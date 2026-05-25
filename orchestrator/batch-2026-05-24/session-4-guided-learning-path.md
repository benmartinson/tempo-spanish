# Session 4 Brief - Guided Learning Path

You are one of several parallel coding sessions. You are not alone in this repo. Work only in your assigned worktree/branch, do not touch other sessions' branches, and do not revert edits you did not make.

## Worktree Setup

From `/Users/benmartinson/workspace/tempo-mobile`:

```bash
git fetch origin main
git worktree add -b codex/guided-learning-path /tmp/tempo-mobile-guided-learning main
cd /tmp/tempo-mobile-guided-learning
npm install
```

Shared status file to update when done:

`/Users/benmartinson/workspace/tempo-mobile/orchestrator/batch-2026-05-24/status.md`

## Task

Add guided learning/course-plan structure so users can get the next best passage instead of manually pressing "Find a good match."

User goal:

- As verb and `top_verb_video` records are created, identify the best ones for learning.
- Group/rank them so the app can retrieve the right passage based on user level and progress.
- Keep it Spanish-only for now.
- Put the UI inside Writing Studio.

## Implementation Guidance

- Do not add Supabase migrations. The user explicitly said no.
- You may add scripts/helpers that create or populate tables if env vars exist, but leave clear Notes and make them idempotent.
- Favor a small, comprehensible model:
  - A learning passage record can point to `top_verb_video`.
  - It should include language, difficulty/level band, rank/order, skill focus, and optional verb id.
  - User progress should track started/completed/skipped/confidence or similar.
- If tables do not exist, implement graceful fallback by deriving recommendations from existing `top_verb_video` plus video difficulty.
- Keep contract boundaries clear so Session 2 can fill `top_verb_video` independently.
- The UI should surface a "next passage" or "guided practice" action in Writing Studio and route into the existing transcript-range selection flow where possible.
- Avoid deep changes to video playback/shadowing internals.

## Acceptance Criteria

- There is a guided learning entry point in Writing Studio.
- The app can choose a next recommended passage from cached verb/video matches.
- The recommendation considers difficulty/level at least at a simple band level.
- The user can mark or advance progress in a way that affects the next recommendation, or the code provides a clear persistence fallback if the DB table is absent.
- The implementation remains functional if `top_verb_video` is sparse.
- Any proposed/expected Supabase tables are documented in Notes, not added as migration files.

## Pre-flight Self-check Before Marking Done

Run:

```bash
git diff --stat main..HEAD
git diff --name-only main..HEAD
npm test -- --runInBand
```

If feasible, run:

```bash
npm run build:web
```

Then:

1. Compare the diff against the files you claim shipped.
2. Verify every imported module or referenced path is either in your diff or already on main.
3. If a file is missing, recover it before claiming done.
4. In the shared status Notes, list side effects outside git: Supabase writes, npm installs, env changes, generated files, expected-but-missing tables, etc.
5. Update only the Session 4 block in the shared status file.

Do not ask mid-build. Make reasonable calls and leave clear Notes for the orchestrator.
