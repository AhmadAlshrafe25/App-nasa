import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, initializeTheme, normalizeTheme } from './theme.ts';

test('Space and Sky remain explicit display choices', () => {
  assert.equal(normalizeTheme('space'), 'space');
  assert.equal(normalizeTheme('sky'), 'sky');
});

test('missing or invalid preferences use the default Space display', () => {
  for (const value of [null, undefined, '', 'dark', {}, false]) {
    assert.equal(normalizeTheme(value), 'space');
  }
});

test('both themes keep the dark browser color, and Sky is restored on reload', () => {
  const dataset: Record<string, string> = {};
  let browserColor = '';
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    documentElement: { dataset },
    querySelector: () => ({ setAttribute: (_key: string, value: string) => { browserColor = value; } }),
  } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '"sky"' } });
  try {
    applyTheme('space');
    assert.equal(dataset.theme, 'space');
    assert.equal(browserColor, '#10152B');
    initializeTheme();
    assert.equal(dataset.theme, 'sky');
    assert.equal(browserColor, '#10152B');
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
