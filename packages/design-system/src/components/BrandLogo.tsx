import React from 'react';
import type { PillarId } from '../tokens/colors.ts';

export type BrandLogoId = 'portal' | PillarId;

export interface BrandLogoSpec {
  id: BrandLogoId;
  name: string;
  primaryWord: string;
  accentWord: string;
  subtitle: string;
  accentHex: string;
  bgTintClass: string;
  borderTintClass: string;
  textAccentClass: string;
  solidBgClass: string;
  faviconPath: string;
}

export const BRAND_LOGO_SPECS: Record<BrandLogoId, BrandLogoSpec> = {
  portal: {
    id: 'portal',
    name: '3C Corp',
    primaryWord: '3C',
    accentWord: 'Corp',
    subtitle: 'Ecossistema Comercial Multiplataforma',
    accentHex: '#f59e0b',
    bgTintClass: 'bg-amber-500/15',
    borderTintClass: 'border-amber-500/30',
    textAccentClass: 'text-amber-400',
    solidBgClass: 'bg-amber-500 text-slate-950',
    faviconPath: '/favicons/corp.svg',
  },
  'store-os': {
    id: 'store-os',
    name: 'Store OS',
    primaryWord: 'Store',
    accentWord: 'OS',
    subtitle: 'Sistema Operacional da Loja',
    accentHex: '#f59e0b',
    bgTintClass: 'bg-amber-500/15',
    borderTintClass: 'border-amber-500/30',
    textAccentClass: 'text-amber-400',
    solidBgClass: 'bg-amber-500 text-slate-950',
    faviconPath: '/favicons/store-os.svg',
  },
  marketplace: {
    id: 'marketplace',
    name: '3C Marketplace',
    primaryWord: '3C',
    accentWord: 'Marketplace',
    subtitle: 'Vitrine Pública & Pedidos',
    accentHex: '#10b981',
    bgTintClass: 'bg-emerald-500/15',
    borderTintClass: 'border-emerald-500/30',
    textAccentClass: 'text-emerald-400',
    solidBgClass: 'bg-emerald-500 text-slate-950',
    faviconPath: '/favicons/marketplace.svg',
  },
  driver: {
    id: 'driver',
    name: '3C Driver',
    primaryWord: '3C',
    accentWord: 'Driver',
    subtitle: 'Logística, Rotas & Entregas',
    accentHex: '#0ea5e9',
    bgTintClass: 'bg-sky-500/15',
    borderTintClass: 'border-sky-500/30',
    textAccentClass: 'text-sky-400',
    solidBgClass: 'bg-sky-500 text-slate-950',
    faviconPath: '/favicons/driver.svg',
  },
  waiter: {
    id: 'waiter',
    name: '3C Waiter',
    primaryWord: '3C',
    accentWord: 'Waiter',
    subtitle: 'Salão, Mesas & Comandas',
    accentHex: '#ec4899',
    bgTintClass: 'bg-pink-500/15',
    borderTintClass: 'border-pink-500/30',
    textAccentClass: 'text-pink-400',
    solidBgClass: 'bg-pink-500 text-slate-950',
    faviconPath: '/favicons/waiter.svg',
  },
  hq: {
    id: 'hq',
    name: 'HQ Central',
    primaryWord: 'HQ',
    accentWord: 'Central',
    subtitle: 'Governança Multi-Tenant',
    accentHex: '#6366f1',
    bgTintClass: 'bg-indigo-500/15',
    borderTintClass: 'border-indigo-500/30',
    textAccentClass: 'text-indigo-400',
    solidBgClass: 'bg-indigo-500 text-white',
    faviconPath: '/favicons/hq.svg',
  },
  'server-core': {
    id: 'server-core',
    name: 'Server Core',
    primaryWord: 'Server',
    accentWord: 'Core',
    subtitle: 'Kernel REST & Edge SQLite',
    accentHex: '#06b6d4',
    bgTintClass: 'bg-cyan-500/15',
    borderTintClass: 'border-cyan-500/30',
    textAccentClass: 'text-cyan-400',
    solidBgClass: 'bg-cyan-500 text-slate-950',
    faviconPath: '/favicons/hq.svg',
  },
};

export type BrandMarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BrandMarkTone = 'tinted' | 'solid' | 'plain';

const CONTAINER_SIZE_CLASSES: Record<BrandMarkSize, string> = {
  xs: 'w-6 h-6 rounded-lg',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
  xl: 'w-14 h-14 rounded-2xl',
};

const SVG_SIZE_CLASSES: Record<BrandMarkSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-7 h-7',
};

const WORDMARK_SIZE_CLASSES: Record<BrandMarkSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

function BrandEmblemGlyph({
  id,
  className,
}: {
  id: BrandLogoId;
  className: string;
}) {
  switch (id) {
    case 'portal':
      // Prism cube symbolizing 3 unified Commerce pillars
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 2.5L20 7.1v9.8L12 21.5L4 16.9V7.1L12 2.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 12L20 7.1M12 12V21.5M12 12L4 7.1"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      );

    case 'store-os':
      // POS counter terminal frame with crisp storefront top bar & dock
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect
            x="3.5"
            y="4"
            width="17"
            height="12"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M7 8.5h10M7 12h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8.5 20h7M12 16v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'marketplace':
      // Architectural storefront bag / shopping arch
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M5 8.5h14l-1.1 10.2a2 2 0 01-2 1.8H8.1a2 2 0 01-2-1.8L5 8.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 8.5V7a3.5 3.5 0 017 0v1.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="14" r="1.75" fill="currentColor" />
        </svg>
      );

    case 'driver':
      // Aerodynamic route arrow + courier beacon
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M4 11.5L20 4.5L13.5 20L11 13L4 11.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="13.5" cy="10.5" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'waiter':
      // Hospitality dining cloche & service tray base
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M4.5 16.5a7.5 7.5 0 0115 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M3 19.5h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 6.5V9M10 6.5h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'hq':
      // Enterprise governance shield with inner crest diamond
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 3l7.5 3v5.5c0 4.8-3.2 8.7-7.5 10-4.3-1.3-7.5-5.2-7.5-10V6L12 3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 8.2L15.2 12L12 15.8L8.8 12L12 8.2Z"
            fill="currentColor"
          />
        </svg>
      );

    case 'server-core':
      // Dual stacked kernel nodes + active core connector
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect
            x="4"
            y="4.5"
            width="16"
            height="6"
            rx="1.75"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="4"
            y="13.5"
            width="16"
            height="6"
            rx="1.75"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="8" cy="7.5" r="1.2" fill="currentColor" />
          <circle cx="8" cy="16.5" r="1.2" fill="currentColor" />
          <path
            d="M13 7.5h3.5M13 16.5h3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export interface BrandMarkProps {
  id: BrandLogoId;
  size?: BrandMarkSize;
  tone?: BrandMarkTone;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  id,
  size = 'md',
  tone = 'tinted',
  className = '',
}) => {
  const spec = BRAND_LOGO_SPECS[id] || BRAND_LOGO_SPECS.portal;
  const svgClass = SVG_SIZE_CLASSES[size];

  if (tone === 'plain') {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        <BrandEmblemGlyph id={spec.id} className={svgClass} />
      </span>
    );
  }

  const surfaceClass =
    tone === 'solid'
      ? spec.solidBgClass
      : `${spec.bgTintClass} border ${spec.borderTintClass} ${spec.textAccentClass}`;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${CONTAINER_SIZE_CLASSES[size]} ${surfaceClass} ${className}`}
    >
      <BrandEmblemGlyph id={spec.id} className={svgClass} />
    </span>
  );
};

export interface BrandLogoProps {
  id: BrandLogoId;
  size?: BrandMarkSize;
  tone?: BrandMarkTone;
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  id,
  size = 'sm',
  tone = 'tinted',
  showSubtitle = false,
  className = '',
}) => {
  const spec = BRAND_LOGO_SPECS[id] || BRAND_LOGO_SPECS.portal;

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <BrandMark id={spec.id} size={size} tone={tone} />
      <span className="min-w-0 leading-tight">
        <span
          className={`block font-bold tracking-tight text-white whitespace-nowrap ${WORDMARK_SIZE_CLASSES[size]}`}
        >
          {spec.primaryWord}{' '}
          <span className={spec.textAccentClass}>{spec.accentWord}</span>
        </span>
        {showSubtitle && (
          <span className="block text-[11px] font-medium text-slate-400 truncate">
            {spec.subtitle}
          </span>
        )}
      </span>
    </span>
  );
};
