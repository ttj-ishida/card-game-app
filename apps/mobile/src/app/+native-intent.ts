// M4-EX-02: OS が渡してくる deep link / App Link を expo-router のパスへ変換する。
// 招待リンク（ragnarokmillennium://join/CODE / https://<host>/join/CODE）は
// online-room 画面へ invite コード付きで飛ばす。それ以外はそのまま通す。

import { parseInviteFromLink } from '../features/online-room/inviteLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const code = parseInviteFromLink(path);
  if (code) return `/online-room?invite=${code}`;
  return path;
}
