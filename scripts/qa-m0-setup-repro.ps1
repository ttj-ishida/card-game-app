param(
  [switch]$SkipDbReset,
  [switch]$SkipExpoExport
)

$ErrorActionPreference = 'Stop'

npm ci
npm --prefix apps/mobile ci
npm run assets:check
npm run ui:test
npm run ui:typecheck
npm run mobile:test
npm run mobile:typecheck
npm run mobile:lint
npm run mobile:format:check

if (-not $SkipExpoExport) {
  Push-Location apps/mobile
  try {
    npx expo export --platform android --output-dir dist
  }
  finally {
    Pop-Location
  }
}

if (-not $SkipDbReset) {
  npm run db:reset -- --local
  npx supabase test db --local supabase/tests/master_schema.sql
  npx supabase test db --local supabase/tests/master_seed.sql
  npx supabase test db --local supabase/tests/master_access.sql
}
