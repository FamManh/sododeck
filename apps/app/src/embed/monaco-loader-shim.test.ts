import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('monaco loader shim (embed build)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hands back the Monaco it was configured with', async () => {
    const { default: loader } = await import('./monaco-loader-shim');
    const monaco = { editor: {} };
    expect(loader.__getMonacoInstance()).toBeNull();
    loader.config({ monaco });
    await expect(loader.init()).resolves.toBe(monaco);
    expect(loader.__getMonacoInstance()).toBe(monaco);
  });

  it('rejects, rather than fetching anything, when Monaco was not configured', async () => {
    const { default: loader } = await import('./monaco-loader-shim');
    const init = loader.init();
    expect(() => {
      init.cancel();
    }).not.toThrow();
    await expect(init).rejects.toThrow(/not configured/);
  });
});
