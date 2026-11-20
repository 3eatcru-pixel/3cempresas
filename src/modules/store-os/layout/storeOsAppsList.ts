import {
  ShoppingCart,
  ChefHat,
  Utensils,
  Package,
  DollarSign,
  Users,
  Calendar,
  BookOpen,
  Truck,
  Barcode,
  Store as StoreIcon,
  Palette,
  CreditCard as BillingIcon,
  Navigation,
  Laptop,
  MessageSquare,
  Gift,
  Layers,
  Terminal,
  ShieldCheck,
  Folder,
  Globe,
  Cpu,
  AppWindow,
  Settings,
  Scissors,
  BarChart3,
  Award,
} from 'lucide-react';
import { Store, UserRole } from '../../../types';
import {
  getDefaultEnabledModulesForCategory,
  isServiceCategory,
} from '../../../utils/storeDomain';

export type WindowAppId =
  | 'dashboard'
  | 'pdv'
  | 'kds'
  | 'catalog'
  | 'inventory'
  | 'tables'
  | 'finance'
  | 'suppliers'
  | 'crm'
  | 'tasks'
  | 'appstore'
  | 'explorer'
  | 'browser'
  | 'terminal'
  | 'audit-logs'
  | 'settings'
  | 'drivers'
  | 'showcase-templates'
  | 'saas-billing'
  | 'staff'
  | 'reservations'
  | 'kiosk'
  | 'whatsapp-marketing'
  | 'shared-inventory'
  | 'cashback'
  | 'pdv-retail'
  | 'pdv-service'
  | 'vitrine-preview'
  | 'logistics';

export interface WindowState {
  id: WindowAppId;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

export interface OsAppDefinition {
  id: WindowAppId;
  title: string;
  icon: any;
  color: string;
  category: string;
  maturity: 'CORE_REAL' | 'ESTÁVEL_BETA' | 'SANDBOX_SIMULADO' | 'PROTÓTIPO_TELA';
  always?: boolean;
  moduleKey?: string;
  badge?: number;
}

const ADMIN_OWNER_ONLY_APPS = new Set<WindowAppId>([
  'staff',
  'saas-billing',
  'settings',
  'appstore',
  'terminal',
  'audit-logs',
]);

const KITCHEN_ALLOWED_APPS = new Set<WindowAppId>(['kds', 'inventory', 'tasks']);

const CASHIER_ALLOWED_APPS = new Set<WindowAppId>([
  'pdv',
  'pdv-retail',
  'pdv-service',
  'kiosk',
  'tables',
  'reservations',
  'crm',
  'drivers',
  'logistics',
  'finance',
  'tasks',
  'vitrine-preview',
]);

const STORE_OS_FULL_CONTROL_ROLES = new Set<UserRole>([
  'DEV_OWNER',
  'SUPER_ADMIN',
  'STORE_OWNER',
]);

const UNBLOCKABLE_TOP_ROLES = new Set<string>([
  'DEV_OWNER',
  'SUPER_ADMIN',
  'STORE_OWNER',
]);

export const isAppAllowedForRole = (
  appId: WindowAppId,
  role?: string | null,
  blockedApps?: string[] | null
): boolean => {
  if (!role) return false;
  if (role === 'WAITER' || role === 'COURIER' || role === 'DRIVER' || role === 'CUSTOMER') {
    return false;
  }
  if (!UNBLOCKABLE_TOP_ROLES.has(role) && Array.isArray(blockedApps) && blockedApps.includes(appId)) {
    return false;
  }
  if (STORE_OS_FULL_CONTROL_ROLES.has(role as UserRole)) return true;
  if (role === 'REGIONAL_MANAGER') {
    return appId !== 'saas-billing';
  }
  if (role === 'STORE_MANAGER') {
    return !ADMIN_OWNER_ONLY_APPS.has(appId);
  }
  if (role === 'CASHIER') {
    return CASHIER_ALLOWED_APPS.has(appId);
  }
  if (role === 'KITCHEN_STAFF') {
    return KITCHEN_ALLOWED_APPS.has(appId);
  }
  return false;
};

const ROLE_DEFAULT_CANDIDATES: Record<string, Array<{ id: WindowAppId; title: string }>> = {
  KITCHEN_STAFF: [
    { id: 'kds', title: 'KDS Cozinha' },
    { id: 'inventory', title: 'Estoque & Ficha Técnica' },
    { id: 'tasks', title: 'Monitor de Processos' },
  ],
  CASHIER: [
    { id: 'pdv', title: 'PDV Balcão' },
    { id: 'pdv-retail', title: 'PDV Gôndola' },
    { id: 'pdv-service', title: 'PDV Serviços' },
    { id: 'tables', title: 'Mesas & Salão' },
    { id: 'finance', title: 'Financeiro & DRE' },
  ],
};

export const getDefaultAppForRole = (
  role?: string | null,
  blockedApps?: string[] | null
): { id: WindowAppId; title: string } | null => {
  if (!role || role === 'WAITER') return null;
  const candidates = ROLE_DEFAULT_CANDIDATES[role] || [
    { id: 'dashboard', title: 'Dashboard' },
    { id: 'pdv', title: 'PDV Balcão' },
    { id: 'catalog', title: 'Cardápio / Catálogo' },
    { id: 'tables', title: 'Mesas & Salão' },
  ];
  for (const candidate of candidates) {
    if (isAppAllowedForRole(candidate.id, role, blockedApps)) {
      return candidate;
    }
  }
  return null;
};

export const getAllAppsList = (kdsPreparationOrdersCount: number): OsAppDefinition[] => [
  { id: 'dashboard', title: 'Dashboard', icon: BarChart3, color: 'from-amber-400 to-amber-600', category: 'Gestão', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'pdv', title: 'PDV Balcão', icon: ShoppingCart, color: 'from-amber-500 to-amber-400', category: 'Vendas', moduleKey: 'pdv', maturity: 'ESTÁVEL_BETA' },
  { id: 'pdv-retail', title: 'PDV Gôndola', icon: Barcode, color: 'from-emerald-500 to-teal-500', category: 'Vendas', moduleKey: 'pdv-retail', maturity: 'ESTÁVEL_BETA' },
  { id: 'pdv-service', title: 'PDV Serviços', icon: Scissors, color: 'from-indigo-500 to-purple-500', category: 'Vendas', moduleKey: 'pdv-service', maturity: 'ESTÁVEL_BETA' },
  { id: 'catalog', title: 'Cardápio / Catálogo', icon: BookOpen, color: 'from-blue-600 to-indigo-500', category: 'Operação', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'kds', title: 'KDS Cozinha', icon: ChefHat, color: 'from-purple-600 to-indigo-500', badge: kdsPreparationOrdersCount, category: 'Operação', moduleKey: 'kds', maturity: 'ESTÁVEL_BETA' },
  { id: 'tables', title: 'Mesas & Salão', icon: Utensils, color: 'from-pink-500 to-rose-500', category: 'Operação', moduleKey: 'tables', maturity: 'ESTÁVEL_BETA' },
  { id: 'kiosk', title: 'Totem de Autoatendimento', icon: Laptop, color: 'from-amber-400 to-orange-500', category: 'Vendas', moduleKey: 'kiosk', maturity: 'ESTÁVEL_BETA' },
  { id: 'inventory', title: 'Estoque & Ficha Técnica', icon: Package, color: 'from-cyan-500 to-blue-500', category: 'Estoque', moduleKey: 'inventory', maturity: 'ESTÁVEL_BETA' },
  { id: 'suppliers', title: 'Fornecedores', icon: Truck, color: 'from-amber-600 to-orange-500', category: 'Estoque', moduleKey: 'inventory', maturity: 'ESTÁVEL_BETA' },
  { id: 'finance', title: 'Financeiro & DRE', icon: DollarSign, color: 'from-emerald-500 to-teal-500', category: 'Gestão', moduleKey: 'finance', maturity: 'ESTÁVEL_BETA' },
  { id: 'crm', title: 'CRM & Fidelidade', icon: Award, color: 'from-blue-500 to-cyan-500', category: 'Marketing', moduleKey: 'crm', maturity: 'ESTÁVEL_BETA' },
  { id: 'drivers', title: 'Frota & Despacho', icon: Truck, color: 'from-orange-500 to-amber-500', category: 'Logística', moduleKey: 'drivers', maturity: 'ESTÁVEL_BETA' },
  { id: 'logistics', title: 'Monitor Logístico', icon: Navigation, color: 'from-orange-600 to-red-500', category: 'Logística', moduleKey: 'drivers', maturity: 'ESTÁVEL_BETA' },
  { id: 'reservations', title: 'Reservas & Agendamento', icon: Calendar, color: 'from-pink-600 to-rose-500', category: 'Operação', moduleKey: 'appointments', maturity: 'ESTÁVEL_BETA' },
  { id: 'staff', title: 'Equipe & Turnos', icon: Users, color: 'from-indigo-600 to-blue-500', category: 'Gestão', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'whatsapp-marketing', title: 'WhatsApp Marketing', icon: MessageSquare, color: 'from-green-600 to-emerald-500', category: 'Marketing', moduleKey: 'whatsapp-marketing', maturity: 'ESTÁVEL_BETA' },
  { id: 'cashback', title: 'Programa de Fidelidade', icon: Gift, color: 'from-purple-600 to-indigo-500', category: 'Marketing', moduleKey: 'cashback', maturity: 'ESTÁVEL_BETA' },
  { id: 'shared-inventory', title: 'Estoque Hub Central', icon: Layers, color: 'from-orange-600 to-rose-500', category: 'Estoque', moduleKey: 'shared-inventory', maturity: 'ESTÁVEL_BETA' },
  { id: 'showcase-templates', title: 'Vitrine Tema', icon: Palette, color: 'from-pink-500 to-rose-400', category: 'Customização', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'vitrine-preview', title: 'Ver Minha Loja', icon: StoreIcon, color: 'from-amber-400 to-yellow-500', category: 'Customização', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'saas-billing', title: 'Minha Assinatura', icon: BillingIcon, color: 'from-emerald-400 to-teal-500', category: 'Sistema', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'settings', title: 'Configurações', icon: Settings, color: 'from-slate-700 to-slate-800', category: 'Sistema', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'terminal', title: 'Terminal Shell', icon: Terminal, color: 'from-slate-900 to-black', category: 'Sistema', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'audit-logs', title: 'Logs de Auditoria', icon: ShieldCheck, color: 'from-emerald-600 to-emerald-900', category: 'Sistema', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'explorer', title: 'Arquivos & Exportações', icon: Folder, color: 'from-blue-400 to-blue-600', category: 'Utilitários', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'browser', title: 'Links & Vitrine Web', icon: Globe, color: 'from-indigo-400 to-blue-500', category: 'Utilitários', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'tasks', title: 'Monitor de Processos', icon: Cpu, color: 'from-slate-600 to-slate-700', category: 'Utilitários', always: true, maturity: 'ESTÁVEL_BETA' },
  { id: 'appstore', title: 'App Store / Módulos', icon: AppWindow, color: 'from-blue-500 to-indigo-500', category: 'Sistema', always: true, maturity: 'ESTÁVEL_BETA' },
];

export const BLOCKABLE_STORE_MODULES: Array<{ id: WindowAppId; title: string; category: string }> =
  getAllAppsList(0).map(({ id, title, category }) => ({ id, title, category }));

export const getVisibleApps = (
  currentStore: Store,
  kdsPreparationOrdersCount: number,
  role?: string | null,
  blockedApps?: string[] | null
): OsAppDefinition[] => {
  const allApps = getAllAppsList(kdsPreparationOrdersCount);
  const defaultModules = getDefaultEnabledModulesForCategory(
    currentStore.category,
    currentStore.operationalSettings?.darkKitchenMode
  );
  const enabled =
    currentStore.enabledModules && currentStore.enabledModules.length > 0
      ? currentStore.enabledModules
      : defaultModules;

  return allApps.filter((app) => {
    if (role !== undefined && !isAppAllowedForRole(app.id, role, blockedApps)) {
      return false;
    }
    if (app.always) return true;
    if (
      currentStore.operationalSettings?.darkKitchenMode &&
      (app.id === 'tables' || app.id === 'reservations')
    ) {
      return false;
    }
    if (
      isServiceCategory(currentStore.category) &&
      (app.id === 'kds' || app.id === 'tables') &&
      !currentStore.enabledModules?.includes(app.id)
    ) {
      return false;
    }
    return enabled.includes(app.moduleKey || app.id);
  });
};
