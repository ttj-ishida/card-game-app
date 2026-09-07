import { Alert, Platform } from 'react-native';

export type ConfirmDialogOptions = {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
};

/**
 * はい / いいえ の確認ダイアログを Promise で返す。
 *
 * ネイティブは `Alert.alert`、Web は `window.confirm` を使う。react-native-web の
 * `Alert.alert` は何も表示せず解決もしないため、退出ボタンなどが「効かない」原因に
 * なっていた。Web はボタン文言を反映できないので本文にタイトルと説明をまとめる。
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
    const ok =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as { confirm?: (m?: string) => boolean }).confirm === 'function'
        ? (globalThis as { confirm: (m?: string) => boolean }).confirm(text)
        : true;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: options.cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmText,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
