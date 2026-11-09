#!/usr/bin/env node
/**
 * Applies every file in supabase/migrations/ (oldest first) to the Supabase project in
 * VITE_SUPABASE_URL, through the Supabase Management API, then checks the result.
 *
 *   npm run db:migrate
 *
 * Needs SUPABASE_ACCESS_TOKEN (a personal access token, ideally scoped to this project) in
 * .env.local or the environment. The app never uses this token at runtime: remove it from
 * .env.local and revoke it in the Supabase dashboard once you're done.
 *
 * Every migration is written to be safe to re-run, so running this again is harmless.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

function loadEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
const ref = projectUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!ref) fail("Set VITE_SUPABASE_URL (https://<project-ref>.supabase.co) in .env.local.");
if (!token) {
  fail(
    "Set SUPABASE_ACCESS_TOKEN in .env.local — create one at https://supabase.com/dashboard/account/tokens",
  );
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "reelmark-db-migrate",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    let reason = text;
    try {
      reason = JSON.parse(text).message ?? text;
    } catch {
      // Not JSON: show the raw body.
    }
    if (res.status === 401) reason = "the access token was rejected (expired or mistyped?)";
    if (res.status === 403) {
      reason = `this token can't change project ${ref}. Give it database read-write access to this project, or use a token from the account that owns it.`;
    }
    throw new Error(`HTTP ${res.status}: ${reason}`);
  }
  return text ? JSON.parse(text) : [];
}

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
if (files.length === 0) fail("No .sql files in supabase/migrations.");

console.log(`Applying ${files.length} migration(s) to project ${ref}…`);
for (const file of files) {
  try {
    await runSql(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    console.log(`  ✓ ${file}`);
  } catch (error) {
    fail(`${file} failed — ${error.message}`);
  }
}

// Check what the app relies on: the tables, row level security on every one of them, and
// the picture bucket.
const tables = await runSql(`
  select c.relname as name, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by 1`);
const buckets = await runSql(`select id, public from storage.buckets where id = 'site-media'`);

const expected = [
  "admin_grants",
  "newsletter_subscribers",
  "orders",
  "products",
  "profiles",
  "rate_limits",
  "reviews",
  "site_content",
];
const byName = new Map(tables.map((t) => [t.name, t]));
let ok = true;
console.log("\nTables:");
for (const name of expected) {
  const table = byName.get(name);
  const status = !table ? "MISSING" : table.rls ? "ok, RLS on" : "RLS OFF";
  if (status !== "ok, RLS on") ok = false;
  console.log(`  ${status === "ok, RLS on" ? "✓" : "✖"} ${name} — ${status}`);
}
for (const table of tables) {
  if (!expected.includes(table.name) && !table.rls) {
    ok = false;
    console.log(`  ✖ ${table.name} — RLS OFF (not part of the store, but exposed to the API)`);
  }
}
console.log(`\nPicture bucket: ${buckets.length > 0 ? "✓ site-media" : "✖ site-media missing"}`);
if (buckets.length === 0) ok = false;

if (!ok) fail("Some checks failed — see above.");
console.log(
  "\n✓ Database is ready. Remove SUPABASE_ACCESS_TOKEN from .env.local and revoke it in the Supabase dashboard if you don't need it any more.\n",
);
