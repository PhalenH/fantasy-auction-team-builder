// Loads .env into process.env if present, using Node's own built-in .env
// parser (process.loadEnvFile) rather than a hand-rolled one — verified
// directly (not inferred from version numbers) to be a stable, non-
// experimental API with no warning on both Node 20.14.0 and 24.18.1
// (matching local dev and Railway respectively). Node's own --env-file flag
// crashes on boot if the file doesn't exist, which broke the moment a
// script needed to run somewhere without a .env file present (Railway
// injects env vars directly, no .env file involved) — the existsSync guard
// here is what --env-file itself doesn't do: skip silently rather than
// throw when the file is absent.
//
// Side-effect-only module. Must be the FIRST import in any entry script
// that reads process.env at module-load time (server/db/pool.ts does, via
// DATABASE_URL) — ES modules evaluate static imports in the order they're
// written, each fully completing before the next one begins, so importing
// this first guarantees process.env is populated before anything else in
// the import graph runs.

import { existsSync } from 'node:fs'

if (existsSync('.env')) {
  process.loadEnvFile('.env')
}
