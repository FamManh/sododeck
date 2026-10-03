/**
 * Icons and names of typed field kinds and status icons (032, frame 124). Shared by the card's
 * fields block, the drawer's field list and the add-field form. Icons come from lucide.
 */
import type { FieldKind, StatusIcon } from '@sododeck/schema';
import {
  Calendar,
  CalendarRange,
  Circle,
  CircleCheck,
  CircleChevronDown,
  CircleDashed,
  CircleDot,
  DoorOpen,
  Eye,
  Gauge,
  Hash,
  Link,
  Type,
  User,
  type LucideIcon,
} from 'lucide-react';

/** The kind menu's order (frame 124 "Field type"), progress last ("Number · as bar"). */
export const KIND_MENU: readonly FieldKind[] = [
  'text',
  'number',
  'select',
  'status',
  'person',
  'date',
  'dateRange',
  'link',
  'progress',
];

export const KIND_NAMES: Record<FieldKind, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  status: 'Status',
  person: 'Person',
  date: 'Date',
  dateRange: 'Date range',
  link: 'Link',
  progress: 'Progress',
};

export const KIND_ICONS: Record<FieldKind, LucideIcon> = {
  text: Type,
  number: Hash,
  select: CircleChevronDown,
  status: CircleDot,
  person: User,
  date: Calendar,
  dateRange: CalendarRange,
  link: Link,
  progress: Gauge,
};

export const STATUS_ICON_LIST: readonly StatusIcon[] = [
  'circle',
  'circle-dashed',
  'circle-dot',
  'circle-check',
  'eye',
  'door-open',
];

export const STATUS_ICONS: Record<StatusIcon, LucideIcon> = {
  circle: Circle,
  'circle-dashed': CircleDashed,
  'circle-dot': CircleDot,
  'circle-check': CircleCheck,
  eye: Eye,
  'door-open': DoorOpen,
};

export const STATUS_ICON_NAMES: Record<StatusIcon, string> = {
  circle: 'Circle',
  'circle-dashed': 'Dashed circle',
  'circle-dot': 'Dotted circle',
  'circle-check': 'Check',
  eye: 'Eye',
  'door-open': 'Open door',
};

/** A status option's icon; absent means `circle` (schema). */
export function statusIconOf(icon: StatusIcon | undefined): LucideIcon {
  return STATUS_ICONS[icon ?? 'circle'];
}
