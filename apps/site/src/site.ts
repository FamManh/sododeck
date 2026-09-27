/** Public URL of the editor app. Override with PUBLIC_APP_URL (e.g. for previews). */
export const APP_URL: string = import.meta.env.PUBLIC_APP_URL ?? 'https://app.sododeck.com';

export const NAV = [
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
] as const;
