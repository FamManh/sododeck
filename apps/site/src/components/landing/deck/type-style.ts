import {
  ArrowLeftRight,
  Box,
  Cloud,
  Database,
  MonitorSmartphone,
  Router,
  type LucideIcon,
} from 'lucide-react';

import type { CardType } from '../../../lib/landing/checkout-deck';

/** Icon and name per card type, as in the type palette (frame 127). */
export const TYPE_STYLE: Record<CardType, { icon: LucideIcon; name: string }> = {
  service: { icon: Box, name: 'Service' },
  database: { icon: Database, name: 'Database' },
  gateway: { icon: Router, name: 'API gateway' },
  client: { icon: MonitorSmartphone, name: 'Client' },
  queue: { icon: ArrowLeftRight, name: 'Queue' },
  external: { icon: Cloud, name: 'External' },
};
