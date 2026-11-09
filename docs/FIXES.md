# Audit fixes (applied after the first full review)

Server
- Removed duplicate index declarations (field-level `unique`/`sparse` plus named `schema.index`) on `User.email`, `User.abhaId`, `Patient.userId`; they made MongoDB throw "Index already exists with a different name" and broke startup and 17 tests.
- `config/db.js`: connect with `autoIndex:false, autoCreate:false`; validators are applied first, then indexes are synced. `models/validators.js` retries on error 12587 and tolerates error 48. This fixes startup crashes on empty and on populated databases.
- `GET /api/analytics/covered-query` returned 500 (one Mongoose query executed twice); now builds two queries.
- Analytics endpoints are physician/triage only; `patient-timeline/:id` enforces ownership for patients.
- Triage queue hides acknowledged cases by default (`?includeAcknowledged=true` to include them), so a newly submitted case appears on the board.
- Tests now use `medikiosk_test` (see `server/src/tests/setupEnv.js`) and no longer wipe the dev database.
- Seed re-applies validators and indexes after `dropDatabase`, keeps seeded drafts under the 7-day TTL, and leaves only the last ~2 days of submitted cases in the live triage queue.
- Benchmark text-search baseline now measures a real full scan; `docs/performance-report.md` regenerated from a 100,000-case run.

Client
- Analytics tab, route and command-palette entry hidden from patients.
- Mobile: lab-value rows stack on phones, inputs use 16px text below 640px (no iOS zoom), `100dvh` instead of `100vh`, no horizontal overflow.
