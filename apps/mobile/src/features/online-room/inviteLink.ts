// M4-EX-02: 招待リンクの生成と解析。純関数のみ（expo-linking などは画面側で使う）。

/** アプリのカスタムスキーム。`app.json` の `scheme` と一致させること。 */
export const APP_SCHEME = 'ragnarokmillennium';

/**
 * HTTPS 招待リンクのホスト。EAS Hosting のデフォルト（slug 由来）。
 * 独自ドメインへ移す場合はここと `app.json` の intentFilters / assetlinks を揃える。
 */
export const INVITE_WEB_HOST = 'card-game-app.expo.app';

const INVITE_CODE_RE = /^[A-Z0-9]{1,24}$/;

function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
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

/** 招待コードから共有用の HTTPS リンクを作る。 */
export function buildInviteWebLink(code: string): string {
  return `https://${INVITE_WEB_HOST}/join/${encodeURIComponent(code.trim().toUpperCase())}`;
}

/** 招待コードからアプリスキームの直リンクを作る。 */
export function buildInviteAppLink(code: string): string {
  return `${APP_SCHEME}://join/${encodeURIComponent(code.trim().toUpperCase())}`;
}
