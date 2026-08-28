export type AppEnv = 'local' | 'development' | 'staging' | 'production';

export type PublicEnv = {
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export type AppConfig = {
  appEnv: AppEnv;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const allowedAppEnvs: ReadonlySet<string> = new Set([
  'local',
  'development',
  'staging',
  'production',
]);

export function parseAppEnv(value: string | undefined): AppEnv {
  if (value && allowedAppEnvs.has(value)) {
    return value as AppEnv;
  }

  throw new Error(`Unsupported EXPO_PUBLIC_APP_ENV: ${value ?? '<missing>'}`);
}

function requirePublicValue(env: PublicEnv, key: keyof PublicEnv): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }

  return value;
}

function assertPublicAnonKey(value: string): void {
  const lowered = value.toLowerCase();
  if (lowered.includes('service_role') || lowered.includes('secret')) {
    throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY must not look like a service role or secret key');
  }
}

export function getAppConfig(env: PublicEnv = process.env as PublicEnv): AppConfig {
  const appEnv = parseAppEnv(env.EXPO_PUBLIC_APP_ENV);
  const supabaseUrl = requirePublicValue(env, 'EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = requirePublicValue(env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

  assertPublicAnonKey(supabaseAnonKey);

  return {
    appEnv,
    supabaseUrl,
    supabaseAnonKey,
  };
}
