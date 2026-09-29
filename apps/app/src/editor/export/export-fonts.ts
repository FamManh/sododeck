export async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  await Promise.all([
    document.fonts.load('500 12.5px "Geist Variable"'),
    document.fonts.load('11px "Geist Mono Variable"'),
  ]);
}
