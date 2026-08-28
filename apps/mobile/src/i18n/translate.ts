export type TranslationKey = keyof typeof jaDictionary;

export const jaDictionary = {
  'app.title': '大貧民2000',
  'home.subtitle': 'M0 開発シェル',
  'home.openCatalog': 'カードカタログを開く',
  'catalog.title': 'カードカタログ',
  'catalog.placeholder': 'M0-QA-01でマスタデータと仮素材を接続します。',
  'catalog.error.network': '通信に失敗しました。',
} as const satisfies Record<string, string>;

export function translate(key: string): string {
  const value = jaDictionary[key as TranslationKey];
  if (!value) {
    throw new Error(`Missing translation key: ${key}`);
  }

  return value;
}
