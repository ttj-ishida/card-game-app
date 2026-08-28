# M0-QA-02 New Setup Reproduction Report

- TODO: M0-QA-02
- Date: 2026-08-28
- Source repository: C:\Projects\card-game-app
- Reproduction directory: C:\Users\tetsu\AppData\Local\Temp\card-game-app-m0-qa-02-20260828233816

## Scope

Reproduced the M0 setup from a separate local clone. The verification covered dependency restoration, asset checks, UI token tests, mobile tests, lint, format check, Android export, Supabase migrations, seed application, and DB tests.

## Important Isolation Note

A direct db reset from the clone was not used because the clone initially shared the same Supabase project_id and ports as the existing local development stack. To avoid resetting the active development database, the clone's temporary supabase/config.toml was changed only inside the temp directory:

| Setting | Temporary value |
|---|---|
| project_id | card-game-app-m0-qa-02 |
| API port | 55421 |
| DB port | 55422 |
| Studio port | 55423 |
| Mail port | 55424 |
| Analytics port | 55427 |
| Pooler port | 55429 |

The isolated stack was stopped after verification.

## Results

| Step | Result | Notes |
|---|---|---|
| git clone from local repository | PASS | Fresh temp directory was created. |
| npm ci | PASS | Root dependencies restored. |
| npm --prefix apps/mobile ci | PASS | Completed with npm audit moderate warnings from installed dependency tree. |
| npm run assets:check | PASS | M0 asset manifests and files valid. |
| npm run ui:test | PASS | 4 tests passed. |
| npm run ui:typecheck | PASS | Shared UI token package typechecks. |
| npm run mobile:test | PASS | 12 tests passed. |
| npm run mobile:typecheck | PASS | Mobile TypeScript passed. |
| npm run mobile:lint | PASS | ESLint passed. |
| npm run mobile:format:check | PASS | Passed after adding .gitattributes LF normalization. |
| npx expo export --platform android --output-dir dist | PASS | Android bundle exported. |
| npx supabase start with isolated ports | PASS | Migrations and seed applied from clone. |
| npx supabase test db --local supabase/tests/master_schema.sql | PASS | 20 DB tests passed. |
| npx supabase test db --local supabase/tests/master_seed.sql | PASS | 19 DB tests passed. |
| npx supabase test db --local supabase/tests/master_access.sql | PASS | 24 DB tests passed. |
| npx supabase stop | PASS | Isolated stack stopped. |

## Defects and Follow-up

| Severity | Count | Notes |
|---|---:|---|
| High | 0 | No high-severity known defects. |
| Medium | 1 | npm ci reports moderate audit findings in mobile dependency tree. This is not blocking M0 setup reproduction but should be reviewed before release milestones. |
| Low | 1 | Direct clone DB reset requires project_id/port isolation when another local Supabase stack is already running. The report and script document this. |

## Regression Registration

- scripts/qa-m0-setup-repro.ps1 captures the repeatable command sequence.
- .gitattributes prevents future Windows clones from failing Prettier format checks due CRLF checkout.
- This report records the temp clone path and isolated Supabase settings used for reproduction.
