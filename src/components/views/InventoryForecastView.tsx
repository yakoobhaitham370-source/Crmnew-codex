import React, { useMemo } from 'react';
import { Boxes, TrendingUp, AlertOctagon, Download, ShoppingCart } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculateInventoryDemand } from '../../utils/pharmacyCalculations';

interface InventoryForecastViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const InventoryForecastView: React.FC<InventoryForecastViewProps> = ({
  patients,
  lang,
  onShowToast,
}) => {
  const forecastItems = useMemo(() => calculateInventoryDemand(patients), [patients]);

  const totalUrgentPacks = useMemo(() => {
    return forecastItems.reduce((acc, item) => acc + item.demand7Days, 0);
  }, [forecastItems]);

  const total30DayPacks = useMemo(() => {
    return forecastItems.reduce((acc, item) => acc + item.estimatedBoxesNeeded, 0);
  }, [forecastItems]);

  const handleExportOrder = () => {
    const headers = ['Medication,GenericClass,ActivePatients,Demand7Days,Demand14Days,EstimatedBoxes30Days'];
    const rows = forecastItems.map(
      item =>
        `"${item.drugName}","${item.genericClass}","${item.activePatientsCount}","${item.demand7Days}","${item.demand14Days}","${item.estimatedBoxesNeeded}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PharmPulse_Stock_Forecast_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    onShowToast(lang === 'ar' ? 'تم تصدير طلبية التوريد المقترحة بنجاح' : 'Exported purchase order CSV', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="bg-surface border border-stroke rounded-[4px] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-extrabold text-lg text-fg flex items-center gap-2">
              <Boxes className="w-5 h-5 text-brand" />
              <span>{lang === 'ar' ? 'التنبؤ الذكي بطلب الأدوية المزمنة والمخزون' : 'Demand Forecasting & Inventory Engine'}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 max-w-3xl">
              {lang === 'ar'
                ? 'تحليل جدول استحقاق الوصفات المزمنة لكافة المرضى النشطين وتحديد الاحتياج المتوقع للطلبيات القادمة لتفادي نفاد الأصناف الحيوية.'
                : 'Aggregated demand projection based on exact chronic refill timelines across all active patients to prevent critical stock-outs.'}
            </p>
          </div>

          <button
            onClick={handleExportOrder}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تصدير طلبية التوريد (CSV)' : 'Export Requisition'}</span>
          </button>
        </div>

        {/* Metric summary badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-canvas border border-stroke p-3.5 rounded-[4px] flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-400">{lang === 'ar' ? 'الأصناف المزمنة المتابعة' : 'Tracked Chronic SKUs'}</div>
              <div className="text-2xl font-extrabold text-fg mt-1">{forecastItems.length}</div>
            </div>
            <Boxes className="w-6 h-6 text-brand" />
          </div>

          <div className="bg-critical-bg border border-critical-border p-3.5 rounded-[4px] flex items-center justify-between">
            <div>
              <div className="text-xs text-critical-fg font-semibold">{lang === 'ar' ? 'عبوات مطلوبة خلال 7 أيام' : 'Urgent (7-Day Demand)'}</div>
              <div className="text-2xl font-extrabold text-critical-fg mt-1">{totalUrgentPacks}</div>
            </div>
            <AlertOctagon className="w-6 h-6 text-critical-fg" />
          </div>

          <div className="bg-brand-subtle border border-brand p-3.5 rounded-[4px] flex items-center justify-between">
            <div>
              <div className="text-xs text-brand font-semibold">{lang === 'ar' ? 'إجمالي الاحتياج الشهري التقديري' : '30-Day Total Projected Boxes'}</div>
              <div className="text-2xl font-extrabold text-brand mt-1">{total30DayPacks}</div>
            </div>
            <ShoppingCart className="w-6 h-6 text-brand" />
          </div>
        </div>
      </div>

      {/* Forecast Table */}
      <div className="bg-surface border border-stroke rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs">
            <thead className="bg-subtle text-neutral-300 font-bold border-b border-stroke">
              <tr>
                <th className="py-3 px-4">{lang === 'ar' ? 'اسم الدواء (العلامة التجارية)' : 'Brand Name'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الفئة العلاجية' : 'Generic Class'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'المرضى النشطون' : 'Active Patients'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'طلب 7 أيام' : '7d Need'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'طلب 14 يوم' : '14d Need'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الطلبية المقترحة (30 يوم)' : '30d Order (Boxes)'}</th>
                <th className="py-3 px-4 text-center">{lang === 'ar' ? 'أولوية التوريد' : 'Priority'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke text-neutral-200">
              {forecastItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-400">
                    <div className="space-y-1">
                      <div className="font-semibold text-neutral-300">
                        {lang === 'ar' ? 'لا توجد أدوية أو مرضى لحساب توقعات المخزون حالياً' : 'No Active Medications to Forecast'}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {lang === 'ar' ? 'أضف مرضى بأدويتهم المزمنة لتوقع كميات الطلبيات ومواعيد إعادة التوريد.' : 'Register patients with chronic regimens to generate demand forecasts.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                forecastItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-fg">
                    {item.drugName}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-mono text-neutral-300 bg-neutral-800/60 px-2 py-0.5 rounded text-[11px]">
                      {item.genericClass}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-neutral-300">
                    {item.activePatientsCount} {lang === 'ar' ? 'مرضى' : 'pts'}
                  </td>
                  <td className="py-3.5 px-3">
                    {item.demand7Days > 0 ? (
                      <span className="font-bold text-critical-fg bg-critical-bg px-2 py-0.5 rounded border border-critical-border">
                        {item.demand7Days} {lang === 'ar' ? 'عبوة' : 'packs'}
                      </span>
                    ) : (
                      <span className="text-neutral-500">0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-warning-fg">
                    {item.demand14Days}
                  </td>
                  <td className="py-3.5 px-3 font-extrabold text-brand text-sm">
                    {item.estimatedBoxesNeeded}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.status === 'critical' ? (
                      <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded bg-critical-bg text-critical-fg border border-critical-border animate-pulse">
                        {lang === 'ar' ? 'حرج وعاجل' : 'Urgent Restock'}
                      </span>
                    ) : item.status === 'warning' ? (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-warning-bg text-warning-fg border border-warning-border">
                        {lang === 'ar' ? 'متابعة قريبة' : 'Medium Priority'}
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                        {lang === 'ar' ? 'مستقر' : 'Stable'}
                      </span>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
