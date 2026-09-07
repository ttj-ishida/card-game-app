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

/**
 * `10.0.2.2` is the Android-emulator alias for the host machine's loopback
 * interface. It is unreachable from a web browser (also from an iOS simulator or
 * a physical device), where every save/sync fetch then fails with
 * `TypeError: Failed to fetch` and results pile up in the retry queue. Rewrite it
 * to `localhost` so one local `.env` (Android-first) also works on web.
 */
export function rewriteAndroidLoopbackHost(url: string): string {
  return url.replace(/^(https?:\/\/)10\.0\.2\.2(?=[:/]|$)/, '$1localhost');
}

function isWebRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
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
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY must not look like a service role or secret key',
    );
  }
}

export function getAppConfig(env: PublicEnv = bundledPublicEnv): AppConfig {
  const appEnv = parseAppEnv(env.EXPO_PUBLIC_APP_ENV);
  const rawSupabaseUrl = requirePublicValue(env, 'EXPO_PUBLIC_SUPABASE_URL');
  const supabaseUrl = isWebRuntime() ? rewriteAndroidLoopbackHost(rawSupabaseUrl) : rawSupabaseUrl;
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
