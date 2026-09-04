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

/**
 * `babel-preset-expo` はソース中の**リテラルな** `process.env.EXPO_PUBLIC_*` 参照だけを
 * ビルド時の値へインライン展開する。`process.env` を丸ごと別名（`env`）に束ねてから
 * メンバアクセスすると展開されず、本番ビルドの Hermes ランタイムでは `process.env` が
 * 空になるため全て `undefined` になる（＝カタログ・オンライン・戦績保存が丸ごと失敗）。
 * ここで各キーをリテラル参照して、その罠を回避する。
 */
const bundledPublicEnv: PublicEnv = {
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

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
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY must not look like a service role or secret key',
    );
  }
}

export function getAppConfig(env: PublicEnv = bundledPublicEnv): AppConfig {
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
export function getOptionalAppConfig(env: PublicEnv = bundledPublicEnv): AppConfig | null {
  try {
    return getAppConfig(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Missing ') || message.startsWith('Unsupported EXPO_PUBLIC_APP_ENV')) {
      return null;
    }
    throw error;
  }
}
