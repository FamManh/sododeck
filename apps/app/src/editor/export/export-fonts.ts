export async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  await Promise.all([
    document.fonts.load('500 12.5px "Geist Variable"'),
    // The Deck card title (029); the variable font already holds the 600 weight.
    document.fonts.load('600 14px "Geist Variable"'),
    document.fonts.load('11px "Geist Mono Variable"'),
  ]);
}
