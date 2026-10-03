/** Public URL of the editor app. Override with PUBLIC_APP_URL (e.g. for previews). */
export const APP_URL: string = import.meta.env.PUBLIC_APP_URL ?? 'https://app.sododeck.com';

/** Where "Get the AI skill" leads. TODO(027): the skill's own docs page once it is published. */
export const SKILL_URL = '/docs';

export const NAV = [
  { href: '/#explore', label: 'Features' },
  { href: '/#database', label: 'Database' },
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
] as const;

export const FOOTER_NAV = [
  { href: '/', label: 'Product' },
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;
