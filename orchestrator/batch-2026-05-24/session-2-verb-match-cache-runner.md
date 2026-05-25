# Session 2 Brief - Verb Match Cache Runner

You are one of several parallel coding sessions. You are not alone in this repo. Work only in your assigned worktree/branch, do not touch other sessions' branches, and do not revert edits you did not make.

## Worktree Setup

From `/Users/benmartinson/workspace/tempo-mobile`:

```bash
git fetch origin main
git worktree add -b codex/verb-match-cache-runner /tmp/tempo-mobile-verb-cache-runner main
cd /tmp/tempo-mobile-verb-cache-runner
npm install
```

Shared status file to update when done:

`/Users/benmartinson/workspace/tempo-mobile/orchestrator/batch-2026-05-24/status.md`

## Task

Create a behind-the-scenes cache runner for Spanish verb match results.

Current app surface:

- `src/components/writing-studio/FindVideoMatch.tsx`
- The relevant flow is `runMatchSearch` -> `findVerbSuggestions` -> `cacheVerbSuggestions`.
- Cached results live in Supabase table `top_verb_video`.
- Current cache row shape used by the UI: `video_id`, `verb_id`, `count`, `difficulty`, `start`, `end`.

Implement Python scripts that reproduce the core cache behavior headlessly:

1. Read Spanish verbs from Supabase table `verb`.
2. Load Spanish videos/transcript segments from the same tables the app uses.
3. Use the same matching semantics as the UI: normalize text, count unique verb forms, find best passage windows, limit top matches by difficulty.
4. Upsert/write `top_verb_video` rows for each verb.
5. Make the runner resumable and idempotent.

Use env vars from `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not add Supabase migrations. The user explicitly said no.

## Implementation Guidance

- Do not attempt to call React `runMatchSearch` from Python. Port or extract pure matching behavior.
- Use the current code as source of truth for normalization and scoring:
  - `normalizeVerbSearchText`
  - `countUniqueVerbForms`
  - `limitVerbSuggestionsByDifficulty`
  - `findVerbSuggestions`
- Prefer a script location like `scripts/cache_spanish_verb_matches.py`.
- Prefer CLI options such as:
  - `--limit-verbs`
  - `--verb`
  - `--dry-run`
  - `--paragraph-count`
  - `--clear-existing`
- If Session 1 has not merged yet, build against the current 3 verbs but make the script automatically handle hundreds once the `verb` table is populated.
- If you need conjugation forms from the TypeScript catalog, either parse a simple generated JSON/data file if available or add a compatible Python-side data source. Leave Notes if integration with Session 1 is needed.
- Avoid duplicate cache rows. If the existing schema lacks a unique constraint, delete existing rows for a verb before inserting replacement rows unless a safer upsert path exists.

## Acceptance Criteria

- A Python script can fill `top_verb_video` for Spanish verbs without user UI interaction.
- The script has dry-run support.
- The script can process one verb or a limited number of verbs for testing.
- The script logs progress and failures per verb.
- The script documents any assumptions about Supabase tables/columns.
- No schema migration files are added.

## Pre-flight Self-check Before Marking Done

Run:

```bash
git diff --stat main..HEAD
git diff --name-only main..HEAD
python3 scripts/cache_spanish_verb_matches.py --help
npm test -- --runInBand
```

If safe dev credentials exist and you can avoid broad writes, also run a dry run:

```bash
python3 scripts/cache_spanish_verb_matches.py --dry-run --limit-verbs 1
```

Then:

1. Compare the diff against the files you claim shipped.
2. Verify every imported module or referenced path is either in your diff or already on main.
3. If a file is missing, recover it before claiming done.
4. In the shared status Notes, list side effects outside git: Supabase writes, npm/pip installs, env changes, generated files, etc.
5. Update only the Session 2 block in the shared status file.

Do not ask mid-build. Make reasonable calls and leave clear Notes for the orchestrator.
