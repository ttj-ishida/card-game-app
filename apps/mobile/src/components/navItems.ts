import type { TranslationKey } from '../i18n/translate';

export type NavItem = {
  key: string;
  labelKey: TranslationKey;
  href: string;
  devOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', labelKey: 'nav.home', href: '/' },
  { key: 'cpu', labelKey: 'nav.cpuGame', href: '/cpu-game/setup' },
  { key: 'online', labelKey: 'nav.onlineRoom', href: '/online-room' },
  { key: 'catalog', labelKey: 'nav.catalog', href: '/catalog' },
  { key: 'sandbox', labelKey: 'nav.sandbox', href: '/sandbox' },
  { key: 'settings', labelKey: 'nav.settings', href: '/cpu-game/settings' },
  { key: 'diagnostics', labelKey: 'nav.diagnostics', href: '/diagnostics', devOnly: true },
];

/** Drop dev-only entries in production builds; order is preserved. */
export function visibleNavItems(items: NavItem[], isProduction: boolean): NavItem[] {
  return isProduction ? items.filter((item) => !item.devOnly) : items;
}
