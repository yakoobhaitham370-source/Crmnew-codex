import React from 'react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  BellRing,
  Boxes,
  LineChart,
  Archive,
  Settings as SettingsIcon,
} from 'lucide-react';

export type ViewType =
  | 'dashboard'
  | 'patients'
  | 'followup'
  | 'timeline'
  | 'inventory'
  | 'reports'
  | 'archive'
  | 'settings';

interface NavigationProps {
  activeView: ViewType;
  onSelectView: (view: ViewType) => void;
  dueRefillsCount: number;
  activeFollowUpsCount: number;
  lang: 'ar' | 'en';
}

export const Navigation: React.FC<NavigationProps> = ({
  activeView,
  onSelectView,
  dueRefillsCount,
  activeFollowUpsCount,
  lang,
}) => {
  const navItems: {
    id: ViewType;
    labelAr: string;
    labelEn: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      labelAr: 'لوحة التحكم',
      labelEn: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'patients',
      labelAr: 'المرضى والعائلات',
      labelEn: 'Patients & Families',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'followup',
      labelAr: 'المتابعة السريرية والمضادات',
      labelEn: 'Clinical Follow-Up',
      icon: <Stethoscope className="w-4 h-4" />,
      badge: activeFollowUpsCount,
      badgeColor: 'bg-warning-bg0/20 text-warning-fg border border-warning-border',
    },
    {
      id: 'timeline',
      labelAr: 'جدول المواعيد والمراجعات',
      labelEn: 'Refill Timeline',
      icon: <BellRing className="w-4 h-4" />,
      badge: dueRefillsCount,
      badgeColor: 'bg-critical-bg0/20 text-critical-fg border border-critical-border',
    },
    {
      id: 'inventory',
      labelAr: 'توقع الطلب والمخزون',
      labelEn: 'Demand Forecast',
      icon: <Boxes className="w-4 h-4" />,
    },
    {
      id: 'reports',
      labelAr: 'التقارير ومؤشرات السريرية',
      labelEn: 'Reports & Vitals',
      icon: <LineChart className="w-4 h-4" />,
    },
    {
      id: 'archive',
      labelAr: 'الأرشيف',
      labelEn: 'Archive',
      icon: <Archive className="w-4 h-4" />,
    },
    {
      id: 'settings',
      labelAr: 'الإعدادات والربط السحابي',
      labelEn: 'Settings & Cloud Sync',
      icon: <SettingsIcon className="w-4 h-4" />,
    },
  ];

  return (
    <nav aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'} className="fluent-pivot bg-surface border-b border-stroke px-4 md:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none sticky top-0 z-30">
      {navItems.map(item => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold whitespace-nowrap border-b-[3px] transition-colors duration-150 cursor-pointer ${
              isActive
                ? 'border-brand text-brand bg-subtle/50 '
                : 'border-transparent text-neutral-400 hover:text-fg hover:bg-neutral-800/40'
            }`}
          >
            {item.icon}
            <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-[4px] ${
                  item.badgeColor || 'bg-neutral-700 text-neutral-200'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
