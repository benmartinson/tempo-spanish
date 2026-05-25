import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * Upserts the app's built-in Spanish verb catalog into the Supabase `verb`
 * table. Run with:
 *
 *   npm run verbs:upsert
 *
 * The script intentionally reads the infinitive list from verbs.ts so the app
 * fallback catalog and database seed stay in one source of truth.
 */

const ENV_PATH = resolve(".env");
const VERBS_PATH = resolve("src/components/writing-studio/verbs.ts");

const parseEnvFile = (path) => {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const equalsIndex = line.indexOf("=");
          if (equalsIndex === -1) return [line, ""];

          const key = line.slice(0, equalsIndex).trim();
          const rawValue = line.slice(equalsIndex + 1).trim();
          const value = rawValue.replace(/^['"]|['"]$/g, "");
          return [key, value];
        }),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
};

const loadVerbInfinitives = () => {
  const source = readFileSync(VERBS_PATH, "utf8");
  const match = source.match(
    /SPANISH_VERB_INFINITIVES\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );

  if (!match) {
    throw new Error(`Could not find SPANISH_VERB_INFINITIVES in ${VERBS_PATH}`);
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), ([, verb]) => verb);
};

const upsertWithNameConflict = async (supabase, rows) => {
  const { error } = await supabase.from("verb").upsert(rows, {
    onConflict: "name",
    ignoreDuplicates: false,
  });

  return error;
};

const insertMissingByName = async (supabase, verbs) => {
  const { data, error } = await supabase
    .from("verb")
    .select("name")
    .in("name", verbs);

  if (error) throw error;

  const existingNames = new Set((data ?? []).map((row) => row.name));
  const missingRows = verbs
    .filter((verb) => !existingNames.has(verb))
    .map((name) => ({ name }));

  if (!missingRows.length) return 0;

  const { error: insertError } = await supabase
    .from("verb")
    .insert(missingRows);
  if (insertError) throw insertError;

  return missingRows.length;
};

const main = async () => {
  const env = { ...parseEnvFile(ENV_PATH), ...process.env };
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/process env.",
    );
  }

  const verbs = loadVerbInfinitives();
  const rows = verbs.map((name) => ({ name }));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const upsertError = await upsertWithNameConflict(supabase, rows);
  if (!upsertError) {
    console.log(`Upserted ${rows.length} Spanish verbs into verb.`);
    return;
  }

  console.warn(
    `Name-conflict upsert failed (${upsertError.message}); inserting missing names instead.`,
  );
  const insertedCount = await insertMissingByName(supabase, verbs);
  console.log(
    `Verified ${verbs.length} Spanish verbs in verb; inserted ${insertedCount} missing rows.`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
