# Tempo Mobile Batch - 2026-05-24

Shared status board for the Spanish verb cache, placement, and guided learning batch.

Sessions should update only their own block. Use the Notes field for coordination details, deferred decisions, side effects outside git, and anything the integration pass must know.

## Session 1 - Spanish Verb Catalog

- Branch: `codex/spanish-verb-catalog`
- Worktree: `/tmp/tempo-mobile-verb-catalog`
- Status: done, uncommitted per user request
- Claimed files shipped: `src/components/writing-studio/verbs.ts`, `src/components/writing-studio/FindVideoMatch.tsx`, `scripts/upsert-spanish-verbs.mjs`, `package.json`
- Tests/checks: `npx tsc --noEmit` passed; `npm test -- --runInBand` passed (2 suites, 21 tests); generated catalog sanity check reported 181 verbs with 53-56 forms each. Required `git diff --stat main..HEAD` and `git diff --name-only main..HEAD` were run and returned empty because the user requested no commits; `git diff --stat main` and `git status --short` verified the uncommitted worktree delta.
- Notes: No commit and no staging performed. Ran `npm install` in `/tmp/tempo-mobile-verb-catalog`. No Supabase writes or env changes were performed; `node scripts/upsert-spanish-verbs.mjs` was invoked only as an env guard check and exited before connecting because `.env`/process env lacked `EXPO_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`. New upsert command is `npm run verbs:upsert`; it reads `.env`, uses service-role auth, and upserts/inserts missing verb names idempotently without migrations.

## Session 2 - Verb Match Cache Runner

- Branch: `codex/verb-match-cache-runner`
- Worktree: `/tmp/tempo-mobile-verb-cache-runner`
- Status: done, unstaged working-tree changes only
- Claimed files shipped: `scripts/cache_spanish_verb_matches.py`
- Tests/checks: `python3 -m py_compile scripts/cache_spanish_verb_matches.py` passed; `python3 scripts/cache_spanish_verb_matches.py --help` passed; `python3 scripts/cache_spanish_verb_matches.py --dry-run --limit-verbs 1` passed and reported 40 dry-run rows for `Haber`; `npm test -- --runInBand` passed (2 suites, 21 tests). Required `git diff --stat main..HEAD` and `git diff --name-only main..HEAD` were run and returned empty because this session did not commit/stage; `git status --short` verified the intended untracked script.
- Notes: Ran `npm install` in `/tmp/tempo-mobile-verb-cache-runner`. No Supabase writes, pip installs, or env changes were performed. Dry-run used service-role credentials loaded from `/Users/benmartinson/workspace/tempo-mobile/.env` via the script's git-worktree `.env` discovery, performed read-only Supabase access, and made no cache writes. The runner uses Supabase REST with system CA bundle fallback, bulk-loads transcript windows by video-id chunk, defaults to clearing each verb's existing `top_verb_video` rows before inserting replacements for idempotency, and falls back to matching the normalized verb name for verbs not yet present in the current TypeScript conjugation catalog. No migrations were added.

## Session 3 - Level Assessment UI

- Branch: `codex/language-level-assessment`
- Worktree: `/tmp/tempo-mobile-level-assessment`
- Status: done
- Claimed files shipped: `src/components/writing-studio/LanguageLevelAssessment.tsx`, `src/components/writing-studio/ChooseComposition.tsx`, `src/components/writing-studio/Composer.tsx`, `src/requests.ts`
- Tests/checks: `npx tsc --noEmit` passed; `git diff --stat main..HEAD` and `git diff --name-only main..HEAD` verified 4 shipped files; `npm test -- --runInBand` passed (2 suites, 21 tests); `npm run build:web` passed.
- Notes: Commit `ec72ece` on the session branch. Ran `npm install` in `/tmp/tempo-mobile-level-assessment`. No Supabase writes or env changes were performed manually. The UI attempts a graceful signed-in upsert to expected table `user_language_level_assessments` with columns `user_id`, `language`, `estimated_level`, `estimated_cefr`, `difficulty_band`, `confidence`, `responses`, `assessed_at`, `updated_at`; if that table or policy is missing, the assessment remains usable and reports a local-only signal. `npm run build:web` generated ignored `dist` output only.

## Session 4 - Guided Learning Path

- Branch: `codex/guided-learning-path`
- Worktree: `/tmp/tempo-mobile-guided-learning`
- Status: done, unstaged working-tree changes only
- Claimed files shipped: `src/components/writing-studio/ChooseComposition.tsx`, `src/components/writing-studio/GuidedLearningPath.tsx`, `src/components/writing-studio/guidedLearning.ts`, `src/components/writing-studio/guidedLearning.test.js`, `docs/guided-learning-notes.md`
- Tests/checks: `npx tsc --noEmit` passed; `npm test -- --runInBand` passed (3 suites, 23 tests); `npm run build:web` passed; `git diff --stat main..HEAD` and `git diff --name-only main..HEAD` are empty because the user requested no commits/staging; working-tree status verified the 5 shipped files above.
- Notes: Ran `npm install` in `/tmp/tempo-mobile-guided-learning`. No Supabase writes or env changes were performed manually. No migrations were added. Guided Practice is Spanish-only inside Writing Studio and derives recommendations from optional `learning_passage`, then `top_verb_video`, then Spanish videos. Progress attempts expected table `user_learning_passage_progress` and falls back to AsyncStorage key `tempo.guidedLearning.progress.es` when absent or unsigned-in. Optional table shapes and an idempotent backfill sketch are documented in `docs/guided-learning-notes.md`. `npm run build:web` generated ignored `dist` output only.

## Orchestrator Integration

- Status: database seed/cache completed; waiting for code integration
- Merge order:
- Smoke checks:
- Notes: On 2026-05-24, loaded `/Users/benmartinson/workspace/tempo-mobile/.env` manually because isolated worktrees do not receive untracked `.env` files. Ran Session 1 verb upsert against dev Supabase; it inserted 181 Spanish verbs, then the original capitalized `Querer`/`Haber`/`Ir` rows caused duplicate groups because the `verb.name` column has no unique constraint. Generated a temporary full conjugation JSON from Session 1's generated `verbs.ts` and injected it into Session 2's cache runner so cache matching used 181 full conjugation sets instead of infinitive-only fallback. Ran the full cache job against dev Supabase. Cleaned duplicates by preserving original ids 1-3, renaming them lowercase, deleting duplicate ids 88/97/140 and their cache rows. Final verification: `verb` has 181 rows, no duplicate normalized names, `top_verb_video` has 7,095 rows, and all 181 verbs have cache rows.
