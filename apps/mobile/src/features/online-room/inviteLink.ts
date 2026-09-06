// M4-EX-02: 招待リンクの生成と解析。純関数のみ（expo-linking などは画面側で使う）。

/** アプリのカスタムスキーム。`app.json` の `scheme` と一致させること。 */
export const APP_SCHEME = 'ragnarokmillennium';

/**
 * HTTPS 招待リンクのホスト。EAS Hosting のデフォルト（slug 由来）。
 * 独自ドメインへ移す場合はここと `app.json` の intentFilters / assetlinks を揃える。
 */
export const INVITE_WEB_HOST = 'card-game-app.expo.app';

/** 招待コードは英数字4〜16文字（大文字へ正規化）。 */
export const INVITE_CODE_RE = /^[A-Z0-9]{4,16}$/;

/** 前後空白を除去し大文字へ。文字種チェックはしない。 */
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

/** 正規化後に `INVITE_CODE_RE` を満たすか。 */
export function isValidInviteCode(input: string): boolean {
  return INVITE_CODE_RE.test(normalizeInviteCode(input));
}

function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = normalizeInviteCode(raw);
  return INVITE_CODE_RE.test(code) ? code : null;
}

/**
 * 招待リンク（`ragnarokmillennium://join/CODE` / `https://host/join/CODE` /
 * どちらも `?code=CODE` 形式）から招待コードを取り出す。join リンクでなければ null。
 */
export function parseInviteFromLink(url: string): string | null {
  if (typeof url !== 'string' || url.length === 0) return null;

  let parsed: URL;
  try {
    // フル URL を優先。パスだけ（`/join/CODE`）で来た場合はダミー origin を補う。
    parsed = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)
      ? new URL(url)
      : new URL(url, 'https://invite.local');
  } catch {
    return null;
  }

  const isAppScheme = parsed.protocol === `${APP_SCHEME}:`;
  const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
  if (!isAppScheme && !isHttp) return null;

  // カスタムスキームでは host が最初のパスセグメントになることがある
  // （`scheme://join/CODE` → host="join"）。両方の並びを吸収する。
  const segments = [parsed.host, ...parsed.pathname.split('/')].filter(Boolean);
  const joinIndex = segments.indexOf('join');
  if (joinIndex === -1) return null;

  const fromPath = segments[joinIndex + 1];
  return normalize(fromPath) ?? normalize(parsed.searchParams.get('code'));
}

/**
 * 招待コードから共有用の HTTPS リンクを作る。コードはパスではなくクエリに置く
 * （`/join?code=…`）— 静的 Web エクスポートで `/join` を素の1ページにでき、
 * 動的ルート `[code]` 用のサーバー出力が不要になる。
 */
export function buildInviteWebLink(code: string): string {
  return `https://${INVITE_WEB_HOST}/join?code=${encodeURIComponent(normalizeInviteCode(code))}`;
}

/** 招待コードからアプリスキームの直リンクを作る。 */
export function buildInviteAppLink(code: string): string {
  return `${APP_SCHEME}://join?code=${encodeURIComponent(normalizeInviteCode(code))}`;
}

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.ttjishida.ragnarokmillennium';
/** iOS 版は未提供。用意でき次第 App Store の URL を入れる。 */
export const APP_STORE_URL: string | null = null;

/**
 * 招待リンクを開いた環境ごとの遷移先。
 * - `app`: そのままアプリ/Webの参加画面へ（ネイティブアプリ内・デスクトップWeb）
 * - `mobile-web`: スマホのブラウザ。アプリ未導入の可能性が高いので Store 案内＋
 *   「アプリで開く」「ブラウザで参加」を提示する
 */
export type JoinTarget =
  | { kind: 'app'; href: string }
  | { kind: 'mobile-web'; store: 'android' | 'ios' | null; code: string | null };

export function resolveJoinTarget(input: {
  platformOS: string;
  userAgent: string;
  code: string | null;
}): JoinTarget {
  const href = input.code ? `/online-room?invite=${input.code}` : '/online-room';
  if (input.platformOS !== 'web') return { kind: 'app', href };

  const ua = input.userAgent ?? '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  if (!isAndroid && !isIOS) return { kind: 'app', href };

  return { kind: 'mobile-web', store: isAndroid ? 'android' : 'ios', code: input.code };
}
