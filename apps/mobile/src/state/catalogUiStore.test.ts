import assert from 'node:assert/strict';
import test from 'node:test';

import { createCatalogUiStore } from './catalogUiStore';

test('catalog UI store starts in the loading state', () => {
  const store = createCatalogUiStore();

  assert.equal(store.getState().status, 'loading');
  assert.equal(store.getState().retryCount, 0);
  assert.equal(store.getState().errorMessageKey, undefined);
});

test('catalog UI store records success and clears errors', () => {
  const store = createCatalogUiStore();

  store.getState().showError('catalog.error.network');
  store.getState().showReady();

  assert.equal(store.getState().status, 'ready');
  assert.equal(store.getState().errorMessageKey, undefined);
});

test('catalog UI store increments retry count when retrying', () => {
  const store = createCatalogUiStore();

  store.getState().showError('catalog.error.network');
  store.getState().retry();
  store.getState().retry();

  assert.equal(store.getState().status, 'loading');
  assert.equal(store.getState().retryCount, 2);
});
