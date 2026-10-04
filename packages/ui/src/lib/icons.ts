import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Box,
  Braces,
  Camera,
  ChartNoAxesGantt,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Cloud,
  CloudCheck,
  Copy,
  CreditCard,
  Database,
  Diamond,
  Download,
  ExternalLink,
  FileText,
  FileType,
  FileUp,
  Focus,
  Folder,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  HardDrive,
  HardDriveDownload,
  Image,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link,
  List,
  LocateFixed,
  Map,
  Maximize,
  MessageSquareText,
  Minus,
  MonitorSmartphone,
  Moon,
  MoveRight,
  Network,
  Pause,
  PenTool,
  Play,
  Plus,
  Puzzle,
  ReceiptText,
  RefreshCw,
  Route,
  Router,
  ScanLine,
  Search,
  Shapes,
  Share,
  SkipBack,
  SkipForward,
  Smartphone,
  Sparkles,
  Spline,
  SquareCheck,
  SquareDashed,
  StickyNote,
  Sun,
  Table,
  Tag,
  Ticket,
  Trash2,
  TriangleAlert,
  Truck,
  Warehouse,
  Waypoints,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon vocabulary for Sododeck. The Claude Design prototype uses Material Symbols; the product
 * uses lucide (AGENTS.md, constitution). This file is the single typed source for both the
 * card-type icons and the full glyph mapping; docs/design/icon-mapping.md mirrors it
 * (a test keeps them in sync).
 */

/** lucide stroke weight that visually matches the prototype's Material Symbols weight 300. */
export const ICON_STROKE_WIDTH = 1.5;

// ── Card types (030) ──

export interface TypeStyle {
  icon: LucideIcon;
  /** The same icon's lucide name, a key of the icon-set table (038: `nodeIcon` resolves it). */
  iconName: string;
  /** Soft fill + ink foreground token classes (DESIGN.md "Type & Semantic Tints"). */
  tone: string;
}

/**
 * Icon and tile tone per card type id. Names, packs and categories live in
 * `@sododeck/model`'s registry (this package never imports it); an app test checks that every
 * registry id has an entry here. Tones reuse the soft tokens: the icon, not the tone, is what
 * tells two types apart.
 */
export const TYPE_STYLE: Readonly<Record<string, TypeStyle>> = {
  service: { icon: Box, iconName: 'box', tone: 'bg-primary-soft text-primary-ink' },
  database: { icon: Database, iconName: 'database', tone: 'bg-blue-soft text-blue-ink' },
  gateway: { icon: Router, iconName: 'router', tone: 'bg-inverse text-on-inverse' },
  client: {
    icon: MonitorSmartphone,
    iconName: 'monitor-smartphone',
    tone: 'bg-surface-2 text-ink-secondary',
  },
  queue: {
    icon: ArrowLeftRight,
    iconName: 'arrow-left-right',
    tone: 'bg-amber-soft text-amber-ink',
  },
  external: { icon: Cloud, iconName: 'cloud', tone: 'bg-clay-soft text-clay-ink' },
  component: { icon: Puzzle, iconName: 'puzzle', tone: 'bg-surface-2 text-ink-secondary' },
  task: { icon: SquareCheck, iconName: 'square-check', tone: 'bg-success-soft text-success-ink' },
  decision: { icon: Diamond, iconName: 'diamond', tone: 'bg-amber-soft text-amber-ink' },
  document: { icon: FileText, iconName: 'file-text', tone: 'bg-blue-soft text-blue-ink' },
  warehouse: { icon: Warehouse, iconName: 'warehouse', tone: 'bg-success-soft text-success-ink' },
  'truck-route': { icon: Truck, iconName: 'truck', tone: 'bg-amber-soft text-amber-ink' },
  issue: { icon: Ticket, iconName: 'ticket', tone: 'bg-clay-soft text-clay-ink' },
};

/**
 * Unknown or missing type: neutral tile, never an error. Uses ink-secondary, not ink-muted,
 * because muted on surface-2 is below AA in light (research.md R5).
 */
export const TYPE_FALLBACK: TypeStyle = {
  icon: Shapes,
  iconName: 'shapes',
  tone: 'bg-surface-2 text-ink-secondary',
};

/** Prototype type names that differ from ours (design-analysis §g-4). */
const TYPE_ALIASES: Readonly<Record<string, string>> = { edge: 'gateway', data: 'database' };

/** The built-in type id a value names (any case; `edge` and `data` accepted), or null. */
export function resolveTypeId(id: string): string | null {
  const key = id.trim().toLowerCase();
  if (Object.hasOwn(TYPE_STYLE, key)) return key;
  return TYPE_ALIASES[key] ?? null;
}

/** Style of a type id (see {@link resolveTypeId}); unknown → fallback. */
export function typeStyle(id: string): TypeStyle {
  const resolved = resolveTypeId(id);
  return (resolved === null ? undefined : TYPE_STYLE[resolved]) ?? TYPE_FALLBACK;
}

// ── Material Symbols → lucide ──

/** Every Material glyph used in docs/design/claude-design (static and runtime-chosen). */
export const MATERIAL_GLYPHS = [
  'account_tree',
  'add',
  'arrow_back',
  'arrow_forward',
  'arrow_outward',
  'arrow_right_alt',
  'auto_awesome',
  'backup',
  'bolt',
  'call_received',
  'center_focus_strong',
  'center_focus_weak',
  'check',
  'check_circle',
  'chevron_right',
  'close',
  'cloud',
  'cloud_done',
  'content_copy',
  'conversion_path',
  'create_new_folder',
  'credit_card',
  'dark_mode',
  'dashboard',
  'data_object',
  'database',
  'delete',
  'deployed_code',
  'description',
  'devices',
  'download',
  'error',
  'expand_less',
  'expand_more',
  'fit_screen',
  'folder',
  'folder_open',
  'grid_view',
  'hub',
  'image',
  'ios_share',
  'key',
  'label',
  'layers',
  'light_mode',
  'link',
  'local_shipping',
  'map',
  'my_location',
  'notifications',
  'open_in_new',
  'pause',
  'payments',
  'photo_camera',
  'picture_as_pdf',
  'play_arrow',
  'polyline',
  'receipt_long',
  'remove',
  'route',
  'router',
  'school',
  'search',
  'select',
  'sell',
  'shape_line',
  'skip_next',
  'skip_previous',
  'smartphone',
  'sms',
  'south',
  'sticky_note_2',
  'storage',
  'swap_horiz',
  'sync',
  'table_chart',
  'timeline',
  'upload_file',
  'view_list',
  'warning',
] as const;

export type MaterialGlyph = (typeof MATERIAL_GLYPHS)[number];

export interface IconMapping {
  icon: LucideIcon;
  /** True when lucide has no equivalent and a near icon stands in. */
  substitute?: true;
  note?: string;
}

export const MATERIAL_TO_LUCIDE: Record<MaterialGlyph, IconMapping> = {
  account_tree: { icon: Network },
  add: { icon: Plus },
  arrow_back: { icon: ArrowLeft },
  arrow_forward: { icon: ArrowRight },
  arrow_outward: { icon: ArrowUpRight },
  arrow_right_alt: { icon: MoveRight },
  auto_awesome: { icon: Sparkles },
  backup: {
    icon: HardDriveDownload,
    substitute: true,
    note: 'lucide has no "backup" glyph; used for the backup banner',
  },
  bolt: { icon: Zap },
  call_received: { icon: ArrowDownLeft },
  center_focus_strong: { icon: Focus },
  center_focus_weak: { icon: ScanLine, substitute: true, note: 'no weak/strong pair in lucide' },
  check: { icon: Check },
  check_circle: { icon: CircleCheck },
  chevron_right: { icon: ChevronRight },
  close: { icon: X },
  cloud: { icon: Cloud },
  cloud_done: { icon: CloudCheck },
  content_copy: { icon: Copy },
  conversion_path: {
    icon: Route,
    substitute: true,
    note: 'flow icon; lucide has no conversion-path glyph',
  },
  create_new_folder: { icon: FolderPlus },
  credit_card: { icon: CreditCard },
  dark_mode: { icon: Moon },
  dashboard: { icon: LayoutDashboard },
  data_object: { icon: Braces },
  database: { icon: Database },
  delete: { icon: Trash2 },
  deployed_code: { icon: Box, substitute: true, note: 'package cube for "service"' },
  description: { icon: FileText },
  devices: { icon: MonitorSmartphone },
  download: { icon: Download },
  error: { icon: CircleAlert },
  expand_less: { icon: ChevronUp },
  expand_more: { icon: ChevronDown },
  fit_screen: { icon: Maximize },
  folder: { icon: Folder },
  folder_open: { icon: FolderOpen },
  grid_view: { icon: LayoutGrid },
  hub: { icon: Waypoints, substitute: true, note: 'no hub glyph in lucide' },
  image: { icon: Image },
  ios_share: { icon: Share },
  key: { icon: KeyRound },
  label: { icon: Tag },
  layers: { icon: Layers },
  light_mode: { icon: Sun },
  link: { icon: Link },
  local_shipping: { icon: Truck },
  map: { icon: Map },
  my_location: { icon: LocateFixed },
  notifications: { icon: Bell },
  open_in_new: { icon: ExternalLink },
  pause: { icon: Pause },
  payments: { icon: Banknote },
  photo_camera: { icon: Camera },
  picture_as_pdf: { icon: FileType, substitute: true, note: 'lucide has no PDF file glyph' },
  play_arrow: { icon: Play },
  polyline: { icon: Spline, substitute: true, note: 'wordmark glyph; lucide has no polyline' },
  receipt_long: { icon: ReceiptText },
  remove: { icon: Minus },
  route: { icon: Route },
  router: { icon: Router },
  school: { icon: GraduationCap },
  search: { icon: Search },
  select: { icon: SquareDashed, substitute: true, note: 'selection frame' },
  sell: { icon: Tag },
  shape_line: { icon: PenTool, substitute: true, note: 'vector format icon' },
  skip_next: { icon: SkipForward },
  skip_previous: { icon: SkipBack },
  smartphone: { icon: Smartphone },
  sms: { icon: MessageSquareText },
  south: { icon: ArrowDown },
  sticky_note_2: { icon: StickyNote },
  storage: { icon: HardDrive },
  swap_horiz: { icon: ArrowLeftRight },
  sync: { icon: RefreshCw },
  table_chart: { icon: Table },
  timeline: { icon: ChartNoAxesGantt, substitute: true, note: 'no timeline glyph in lucide' },
  upload_file: { icon: FileUp },
  view_list: { icon: List },
  warning: { icon: TriangleAlert },
};
