# Session 1 Brief - Spanish Verb Catalog

You are one of several parallel coding sessions. You are not alone in this repo. Work only in your assigned worktree/branch, do not touch other sessions' branches, and do not revert edits you did not make.

## Worktree Setup

From `/Users/benmartinson/workspace/tempo-mobile`:

```bash
git fetch origin main
git worktree add -b codex/spanish-verb-catalog /tmp/tempo-mobile-verb-catalog main
cd /tmp/tempo-mobile-verb-catalog
npm install
```

Shared status file to update when done:

`/Users/benmartinson/workspace/tempo-mobile/orchestrator/batch-2026-05-24/status.md`

## Task

Expand Spanish verb coverage for the Practice Focus > Verb forms flow.

Current app surface:

- `src/components/writing-studio/FindVideoMatch.tsx` loads Spanish verbs from Supabase table `verb`, then falls back to local verb keys in `src/components/writing-studio/verbs.ts`.
- `src/components/writing-studio/verbs.ts` currently has only `querer`, `haber`, and `ir`.
- Matching relies on `SPANISH_VERB_CONJUGATIONS` to count forms in transcript text.

Implement a maintainable catalog of at least 100 commonly heard modern Spanish verbs, preferably 150-250 if feasible without making the file unreadable. Include the infinitive and enough conjugated forms to support text matching in native transcripts. Prioritize present, preterite, imperfect, future, conditional, subjunctive/common irregular forms, gerund, participles, and imperative where useful.

Add a script that can upsert those verbs into the dev Supabase `verb` table using env vars from `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not add Supabase migrations. The user explicitly said no.

## Implementation Guidance

- Keep the app import contract stable if practical: `SPANISH_VERB_CONJUGATIONS` and `SpanishVerbMatchKey` should still work for `FindVideoMatch.tsx`.
- It is okay to introduce a generated/data-backed source if it makes the catalog maintainable, but the app must still get a typed `Record<SpanishVerbMatchKey, string[]>`.
- If you add a generator, document the command in comments or README-style script notes.
- The upsert script should be idempotent. Rerunning it must not create duplicates.
- Use the existing dependency stack when possible. Avoid adding packages unless there is a strong reason.
- Do not run live Supabase writes unless the user/session environment clearly has `.env` and you are comfortable the script is targeting dev. If you do run it, list it in Notes.

## Acceptance Criteria

- At least 100 Spanish verbs are available to the app.
- Each verb has useful matching forms, not just the infinitive.
- A script exists to upsert verbs to Supabase.
- The script reads `.env` and uses service role auth.
- Rerunning the script is safe.
- `FindVideoMatch.tsx` still compiles against the verb exports.

## Pre-flight Self-check Before Marking Done

Run:

```bash
git diff --stat main..HEAD
git diff --name-only main..HEAD
npm test -- --runInBand
```

Then:

1. Compare the diff against the files you claim shipped.
2. Verify every imported module or referenced path is either in your diff or already on main.
3. If a file is missing, recover it before claiming done.
4. In the shared status Notes, list side effects outside git: Supabase writes, npm installs, env changes, generated files, etc.
5. Update only the Session 1 block in the shared status file.

Do not ask mid-build. Make reasonable calls and leave clear Notes for the orchestrator.
