import assert from 'node:assert/strict';
import test from 'node:test';

import { getAppConfig, parseAppEnv } from './appEnv';

test('parseAppEnv accepts only known app environments', () => {
  assert.equal(parseAppEnv('local'), 'local');
  assert.equal(parseAppEnv('development'), 'development');
  assert.equal(parseAppEnv('staging'), 'staging');
  assert.equal(parseAppEnv('production'), 'production');
  assert.throws(() => parseAppEnv('preview'), /Unsupported EXPO_PUBLIC_APP_ENV/);
});

test('getAppConfig returns public Supabase settings for the selected environment', () => {
  const config = getAppConfig({
    EXPO_PUBLIC_APP_ENV: 'local',
    EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
  });

  assert.deepEqual(config, {
    appEnv: 'local',
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseAnonKey: 'local-anon-key',
  });
});

test('getAppConfig rejects missing public settings', () => {
  assert.throws(
    () => getAppConfig({ EXPO_PUBLIC_APP_ENV: 'development' }),
    /Missing EXPO_PUBLIC_SUPABASE_URL/,
  );
});

test('getAppConfig rejects private-looking keys in public config', () => {
  assert.throws(
    () =>
      getAppConfig({
        EXPO_PUBLIC_APP_ENV: 'local',
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'service_role_secret',
      }),
    /must not look like a service role or secret key/,
  );
});
