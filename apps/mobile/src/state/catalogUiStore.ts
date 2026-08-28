import { createStore } from 'zustand/vanilla';

export type CatalogUiStatus = 'loading' | 'ready' | 'empty' | 'error';

export type CatalogUiState = {
  status: CatalogUiStatus;
  retryCount: number;
  errorMessageKey?: string;
  showReady: () => void;
  showEmpty: () => void;
  showError: (messageKey: string) => void;
  retry: () => void;
};

export function createCatalogUiStore() {
  return createStore<CatalogUiState>((set) => ({
    status: 'loading',
    retryCount: 0,
    showReady: () => set({ status: 'ready', errorMessageKey: undefined }),
    showEmpty: () => set({ status: 'empty', errorMessageKey: undefined }),
    showError: (messageKey) => set({ status: 'error', errorMessageKey: messageKey }),
    retry: () =>
      set((state) => ({
        status: 'loading',
        retryCount: state.retryCount + 1,
        errorMessageKey: undefined,
      })),
  }));
}

export const catalogUiStore = createCatalogUiStore();
