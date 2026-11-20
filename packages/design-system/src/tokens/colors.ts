/**
 * 3C Corp Semantic Color Tokens Core (@3c/design-system)
 * Centraliza tokens de cor por pilar, superfície, status operacional, papel RBAC e transporte.
 */

export type PillarId = 'hq' | 'store-os' | 'marketplace' | 'server-core' | 'driver' | 'waiter';

export interface PillarColorTheme {
  id: PillarId;
  label: string;
  accentHex: string;
  accentTextClass: string;
  hoverTextClass: string;
  groupHoverTextClass: string;
  accentBgClass: string;
  accentBorderClass: string;
  hoverBorderClass: string;
  badgeClass: string;
  glowClass: string;
}

export const PILLAR_THEMES: Record<PillarId, PillarColorTheme> = {
  hq: {
    id: 'hq',
    label: 'HQ Central',
    accentHex: '#6366f1',
    accentTextClass: 'text-indigo-400',
    hoverTextClass: 'hover:text-indigo-400',
    groupHoverTextClass: 'group-hover:text-indigo-400',
    accentBgClass: 'bg-indigo-500',
    accentBorderClass: 'border-indigo-500/30',
    hoverBorderClass: 'hover:border-indigo-500/40',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    glowClass: 'shadow-indigo-500/20',
  },
  'store-os': {
    id: 'store-os',
    label: 'Store OS',
    accentHex: '#f59e0b',
    accentTextClass: 'text-amber-400',
    hoverTextClass: 'hover:text-amber-400',
    groupHoverTextClass: 'group-hover:text-amber-400',
    accentBgClass: 'bg-amber-500',
    accentBorderClass: 'border-amber-500/30',
    hoverBorderClass: 'hover:border-amber-500/40',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    glowClass: 'shadow-amber-500/20',
  },
  marketplace: {
    id: 'marketplace',
    label: 'Marketplace Público',
    accentHex: '#10b981',
    accentTextClass: 'text-emerald-400',
    hoverTextClass: 'hover:text-emerald-400',
    groupHoverTextClass: 'group-hover:text-emerald-400',
    accentBgClass: 'bg-emerald-500',
    accentBorderClass: 'border-emerald-500/30',
    hoverBorderClass: 'hover:border-emerald-500/40',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    glowClass: 'shadow-emerald-500/20',
  },
  'server-core': {
    id: 'server-core',
    label: 'Server Core & Edge',
    accentHex: '#06b6d4',
    accentTextClass: 'text-cyan-400',
    hoverTextClass: 'hover:text-cyan-400',
    groupHoverTextClass: 'group-hover:text-cyan-400',
    accentBgClass: 'bg-cyan-500',
    accentBorderClass: 'border-cyan-500/30',
    hoverBorderClass: 'hover:border-cyan-500/40',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
    glowClass: 'shadow-cyan-500/20',
  },
  driver: {
    id: 'driver',
    label: '3C Driver',
    accentHex: '#0ea5e9',
    accentTextClass: 'text-sky-400',
    hoverTextClass: 'hover:text-sky-400',
    groupHoverTextClass: 'group-hover:text-sky-400',
    accentBgClass: 'bg-sky-500',
    accentBorderClass: 'border-sky-500/30',
    hoverBorderClass: 'hover:border-sky-500/40',
    badgeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    glowClass: 'shadow-sky-500/20',
  },
  waiter: {
    id: 'waiter',
    label: '3C Waiter',
    accentHex: '#ec4899',
    accentTextClass: 'text-pink-400',
    hoverTextClass: 'hover:text-pink-400',
    groupHoverTextClass: 'group-hover:text-pink-400',
    accentBgClass: 'bg-pink-500',
    accentBorderClass: 'border-pink-500/30',
    hoverBorderClass: 'hover:border-pink-500/40',
    badgeClass: 'bg-pink-500/15 text-pink-300 border border-pink-500/30',
    glowClass: 'shadow-pink-500/20',
  },
};

export const SURFACE_TOKENS = {
  dark: {
    canvasBg: 'bg-slate-950',
    elevatedBg: 'bg-slate-900',
    subtleBg: 'bg-slate-900/60',
    border: 'border-slate-800',
    borderStrong: 'border-slate-700',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-300',
    textMuted: 'text-slate-400',
    textSubtle: 'text-slate-500',
  },
  light: {
    canvasBg: 'bg-stone-50',
    elevatedBg: 'bg-white',
    subtleBg: 'bg-stone-100',
    border: 'border-stone-200',
    borderStrong: 'border-stone-300',
    textPrimary: 'text-stone-900',
    textSecondary: 'text-stone-700',
    textMuted: 'text-stone-500',
    textSubtle: 'text-stone-400',
  },
} as const;

export type SemanticStatus =
  | 'SUCCESS'
  | 'WARNING'
  | 'DANGER'
  | 'INFO'
  | 'NEUTRAL';

export interface StatusColorToken {
  hex: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
}

export const STATUS_COLORS: Record<SemanticStatus, StatusColorToken> = {
  SUCCESS: {
    hex: '#10b981',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  WARNING: {
    hex: '#f59e0b',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  },
  DANGER: {
    hex: '#f43f5e',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  },
  INFO: {
    hex: '#0ea5e9',
    textClass: 'text-sky-400',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/30',
    badgeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  },
  NEUTRAL: {
    hex: '#64748b',
    textClass: 'text-slate-400',
    bgClass: 'bg-slate-800/60',
    borderClass: 'border-slate-700',
    badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
  },
};

export const TRANSPORT_COLORS = {
  CLOUD: STATUS_COLORS.SUCCESS,
  EDGE: STATUS_COLORS.INFO,
  EDGE_LAN: STATUS_COLORS.INFO,
  LOCAL: STATUS_COLORS.WARNING,
  OFFLINE: STATUS_COLORS.DANGER,
} as const;

export const ROLE_COLORS: Record<string, StatusColorToken> = {
  DEV_OWNER: {
    hex: '#a855f7',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
  },
  SUPER_ADMIN: STATUS_COLORS.WARNING,
  REGIONAL_MANAGER: STATUS_COLORS.INFO,
  STORE_OWNER: STATUS_COLORS.SUCCESS,
  STORE_MANAGER: STATUS_COLORS.SUCCESS,
  CASHIER: STATUS_COLORS.INFO,
  KITCHEN_STAFF: STATUS_COLORS.WARNING,
  WAITER: {
    hex: '#ec4899',
    textClass: 'text-pink-400',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/30',
    badgeClass: 'bg-pink-500/15 text-pink-300 border border-pink-500/30',
  },
  COURIER: STATUS_COLORS.INFO,
  CUSTOMER: STATUS_COLORS.NEUTRAL,
};

export const COMMERCE_SEGMENT_COLORS: Record<
  'FOOD' | 'FURNITURE' | 'ELECTRONICS' | 'FASHION' | 'SERVICE' | 'RETAIL_GENERAL',
  StatusColorToken
> = {
  FOOD: STATUS_COLORS.WARNING,
  FURNITURE: STATUS_COLORS.INFO,
  ELECTRONICS: {
    hex: '#06b6d4',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  },
  FASHION: {
    hex: '#ec4899',
    textClass: 'text-pink-400',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/30',
    badgeClass: 'bg-pink-500/15 text-pink-300 border border-pink-500/30',
  },
  SERVICE: {
    hex: '#6366f1',
    textClass: 'text-indigo-400',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/30',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  },
  RETAIL_GENERAL: STATUS_COLORS.SUCCESS,
};

export const ORDER_STATUS_COLORS: Record<string, StatusColorToken> = {
  PENDING: STATUS_COLORS.WARNING,
  CONFIRMED: STATUS_COLORS.INFO,
  IN_PREPARATION: STATUS_COLORS.WARNING,
  READY: STATUS_COLORS.SUCCESS,
  READY_FOR_PICKUP: STATUS_COLORS.INFO,
  OUT_FOR_DELIVERY: STATUS_COLORS.INFO,
  DELIVERED: STATUS_COLORS.SUCCESS,
  CANCELLED: STATUS_COLORS.DANGER,
};

export type StoreOsWallpaperId = 'neon-dark' | 'emerald-glass' | 'sunset-gold' | 'pink-gradient';

export const STORE_OS_WALLPAPERS: Record<
  StoreOsWallpaperId,
  { id: StoreOsWallpaperId; label: string; gradientClass: string; swatchClass: string }
> = {
  'neon-dark': {
    id: 'neon-dark',
    label: 'Obsidian Indigo',
    gradientClass: 'from-slate-950 via-[#070b14] to-indigo-950/70',
    swatchClass: 'bg-indigo-600',
  },
  'emerald-glass': {
    id: 'emerald-glass',
    label: 'Emerald Glass',
    gradientClass: 'from-emerald-950 via-teal-950 to-slate-950',
    swatchClass: 'bg-emerald-500',
  },
  'sunset-gold': {
    id: 'sunset-gold',
    label: 'Amber Commerce',
    gradientClass: 'from-amber-900/70 via-slate-950 to-slate-950',
    swatchClass: 'bg-amber-500',
  },
  'pink-gradient': {
    id: 'pink-gradient',
    label: 'Horizon Vivid',
    gradientClass: 'from-pink-900/60 via-slate-950 to-cyan-950/80',
    swatchClass: 'bg-pink-500',
  },
};

export function getPillarTheme(pillar: PillarId): PillarColorTheme {
  return PILLAR_THEMES[pillar] || PILLAR_THEMES['store-os'];
}

export function getStatusColorToken(rawStatus?: string | null): StatusColorToken {
  const s = String(rawStatus || '').toUpperCase();
  if (['ACTIVE', 'PAID', 'ONLINE', 'DELIVERED', 'READY', 'FREE', 'CONFIRMED', 'APPROVED', 'CONNECTED', 'RESOLVED'].includes(s)) {
    return STATUS_COLORS.SUCCESS;
  }
  if (['PENDING', 'PENDING_ACTIVATION', 'PENDING_PAIRING', 'TRIAL', 'IN_PREPARATION', 'BILL_REQUESTED', 'WAITLIST', 'DEGRADED'].includes(s)) {
    return STATUS_COLORS.WARNING;
  }
  if (['DISABLED', 'SUSPENDED', 'OVERDUE', 'CANCELLED', 'OFFLINE', 'REVOKED', 'ERROR', 'CRITICAL', 'FAILED'].includes(s)) {
    return STATUS_COLORS.DANGER;
  }
  if (['OCCUPIED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'EDGE', 'SYNCING'].includes(s)) {
    return STATUS_COLORS.INFO;
  }
  return STATUS_COLORS.NEUTRAL;
}

export function getStoreCategoryPrimaryHex(category?: string | null): string {
  const cat = String(category || '').toUpperCase();
  if (cat === 'FOOD' || cat === 'BURGER' || cat === 'RESTAURANT') return COMMERCE_SEGMENT_COLORS.FOOD.hex;
  if (cat === 'PIZZA') return '#ef4444';
  if (cat === 'FURNITURE') return COMMERCE_SEGMENT_COLORS.FURNITURE.hex;
  if (cat === 'ELECTRONICS') return COMMERCE_SEGMENT_COLORS.ELECTRONICS.hex;
  if (cat === 'FASHION') return COMMERCE_SEGMENT_COLORS.FASHION.hex;
  if (cat === 'SERVICES' || cat === 'SERVICE' || cat === 'BEAUTY') return COMMERCE_SEGMENT_COLORS.SERVICE.hex;
  if (cat === 'RETAIL' || cat === 'JAPANESE') return COMMERCE_SEGMENT_COLORS.RETAIL_GENERAL.hex;
  if (cat === 'BEVERAGES') return '#ec4899';
  if (cat === 'MULTI_COMMERCE') return '#6366f1';
  return '#f59e0b';
}
