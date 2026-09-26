import { createNavigation } from 'next-intl/navigation';
import { routing } from './I18nRouting';

/** Locale-aware navigation APIs; use instead of `next/link` and `next/navigation`. @public */
export const { Link, usePathname, useRouter } = createNavigation(routing);
