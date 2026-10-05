// In-memory IndexedDB for the storage tests (research R13); a no-op where tests don't use it.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Some tests (layout worker) run in the node environment, without a DOM.
if (typeof window !== 'undefined') {
  // jsdom lacks the layout APIs React Flow and Radix call. These stubs only keep them from
  // throwing; tests assert behavior through roles and the document, never through geometry.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  class DOMMatrixStub {
    m22: number;
    constructor(transform?: string) {
      const scale = /scale\(([\d.]+)\)/.exec(transform ?? '')?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  if (typeof globalThis.DOMMatrixReadOnly === 'undefined') {
    globalThis.DOMMatrixReadOnly = DOMMatrixStub as unknown as typeof DOMMatrixReadOnly;
  }

  // jsdom has no CSS namespace; ids in tests need no real escaping.
  if (typeof (globalThis as { CSS?: unknown }).CSS === 'undefined') {
    globalThis.CSS = { escape: (value: string) => value.replace(/["\\]/g, '\\$&') } as typeof CSS;
  }

  // Object URLs of pictures (055): jsdom's Blob is not the one vitest's URL polyfill expects.
  // Tests that look at the URL replace these.
  let objectUrls = 0;
  URL.createObjectURL = () => `blob:sododeck-test/${String(objectUrls++)}`;
  URL.revokeObjectURL = () => undefined;

  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    });
  }
}

afterEach(cleanup);
