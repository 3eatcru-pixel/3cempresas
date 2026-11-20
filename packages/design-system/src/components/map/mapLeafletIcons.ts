import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { escapeHtml } from './mapTypesAndIcons';

export const createCustomIcon = (
  type?: 'store' | 'driver' | 'customer' | 'cluster',
  label?: string,
  count?: number
) => {
  const safeLabel = label ? escapeHtml(label) : '';

  if (type === 'cluster') {
    const safeCount = Number.isFinite(count) && (count as number) > 0 ? Math.floor(count as number) : 1;
    return L.divIcon({
      className: 'custom-leaflet-cluster-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 rounded-full bg-amber-500/30 animate-ping"></div>
          <div class="relative w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black flex items-center justify-center shadow-xl border-2 border-slate-900 text-xs">
            ${safeCount}
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }

  if (type === 'driver') {
    return L.divIcon({
      className: 'custom-leaflet-driver-icon',
      html: `
        <div class="flex flex-col items-center">
          ${safeLabel ? `<div class="bg-slate-900 border border-emerald-500 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-black shadow-md whitespace-nowrap mb-0.5">${safeLabel}</div>` : ''}
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full bg-emerald-500/40 animate-ping"></div>
            <div class="relative w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shadow-lg border-2 border-white text-xs">
              🛵
            </div>
          </div>
        </div>
      `,
      iconSize: safeLabel ? [44, 50] : [32, 32],
      iconAnchor: safeLabel ? [22, 36] : [16, 16],
    });
  }

  if (type === 'store') {
    return L.divIcon({
      className: 'custom-leaflet-store-icon',
      html: `
        <div class="flex flex-col items-center">
          <div class="bg-slate-900 border-2 border-amber-500 text-amber-400 px-2 py-0.5 rounded-lg text-[10px] font-black shadow-md whitespace-nowrap mb-0.5">
            ${safeLabel || 'Loja'}
          </div>
          <div class="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border border-slate-900 text-xs">
            🏪
          </div>
        </div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 44],
    });
  }

  if (type === 'customer') {
    return L.divIcon({
      className: 'custom-leaflet-customer-icon',
      html: `
        <div class="flex flex-col items-center">
          <div class="bg-slate-900 border border-emerald-500 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-black shadow-md whitespace-nowrap mb-0.5">
            ${safeLabel || 'Cliente'}
          </div>
          <div class="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border border-slate-900 text-xs">
            📍
          </div>
        </div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 44],
    });
  }

  return L.divIcon({
    className: 'custom-leaflet-default-pin',
    html: `
      <div class="flex flex-col items-center">
        ${safeLabel ? `<div class="bg-slate-900 border border-slate-600 text-white px-2 py-0.5 rounded text-[9px] font-bold shadow whitespace-nowrap mb-0.5">${safeLabel}</div>` : ''}
        <div class="w-6 h-6 rounded-full bg-amber-500 border-2 border-slate-950 shadow-lg flex items-center justify-center text-[10px] font-black text-slate-950">•</div>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 30],
  });
};
