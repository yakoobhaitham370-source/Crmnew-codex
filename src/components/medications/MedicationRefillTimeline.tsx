import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Activity,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  X,
  Sparkles,
} from 'lucide-react';
import { Medication, RefillRecord } from '../../types/pharmacy';
import {
  analyzeMedicationAdherence,
  addDaysToYMD,
  diffDaysYMD,
} from '../../utils/adherenceCalculations';
import { formatYMD } from '../../utils/pharmacyCalculations';

interface MedicationRefillTimelineProps {
  medication: Medication;
  lang: 'ar' | 'en';
  onUpdateRefillHistory?: (newHistory: RefillRecord[]) => void;
}

export const MedicationRefillTimeline: React.FC<MedicationRefillTimelineProps> = ({
  medication,
  lang,
  onUpdateRefillHistory,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Quick form state
  const [inputDate, setInputDate] = useState<string>(() => {
    // Default to 30 days prior to lastDispenseDate
    const baseDate = medication.lastDispenseDate || formatYMD(new Date());
    return addDaysToYMD(baseDate, -30);
  });
  const [inputDaysSupply, setInputDaysSupply] = useState<number>(medication.daysSupply || 30);
  const [inputNote, setInputNote] = useState<string>('');

  const analysis = analyzeMedicationAdherence(medication);

  // Get current normalized history for mutating
  const getCurrentRecords = (): RefillRecord[] => {
    if (!medication.refillHistory) return [];
    return medication.refillHistory.map((r, i) => {
      if (typeof r === 'string') {
        return {
          id: `rec-${i}`,
          date: r,
          daysSupply: medication.daysSupply || 30,
        };
      }
      return r;
    });
  };

  const handleAddRefillDate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputDate || !onUpdateRefillHistory) return;

    const current = getCurrentRecords();
    // Prevent duplicate exact date
    if (current.some(r => r.date === inputDate) || medication.lastDispenseDate === inputDate) {
      alert(lang === 'ar' ? 'هذا التاريخ مسجل بالفعل لهذا الدواء' : 'This refill date already exists');
      return;
    }

    const updated = [
      ...current,
      {
        id: `rec-${Date.now()}`,
        date: inputDate,
        daysSupply: Number(inputDaysSupply) || 30,
        note: inputNote.trim() || undefined,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    onUpdateRefillHistory(updated);
    setShowAddForm(false);
    setInputNote('');
  };

  const handleQuickAddPreset = (daysAgo: number) => {
    if (!onUpdateRefillHistory) return;
    const baseDate = medication.lastDispenseDate || formatYMD(new Date());
    const targetDate = addDaysToYMD(baseDate, -daysAgo);

    const current = getCurrentRecords();
    if (current.some(r => r.date === targetDate) || medication.lastDispenseDate === targetDate) {
      return;
    }

    const updated = [
      ...current,
      {
        id: `rec-${Date.now()}-${daysAgo}`,
        date: targetDate,
        daysSupply: medication.daysSupply || 30,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    onUpdateRefillHistory(updated);
  };

  const handleRemoveRefill = (targetDate: string) => {
    if (!onUpdateRefillHistory) return;
    const current = getCurrentRecords();
    const updated = current.filter(r => r.date !== targetDate);
    onUpdateRefillHistory(updated);
  };

  // Status styling helper
  const getStatusBadgeStyle = (pattern: typeof analysis.overallPattern) => {
    switch (pattern) {
      case 'optimal':
        return 'bg-success-bg0/10 text-success-fg border-success-border';
      case 'mild-irregular':
        return 'bg-warning-bg0/10 text-warning-fg border-warning-border';
      case 'severe-irregular':
        return 'bg-critical-bg0/10 text-critical-fg border-critical-border';
      case 'early-overuse':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-neutral-800 text-neutral-300 border-neutral-700';
    }
  };

  return (
    <div className="mt-3 border border-stroke rounded-[4px] bg-surface overflow-hidden text-xs transition-colors duration-150">
      {/* Timeline Bar Header */}
      <div className="p-3 bg-surface border-b border-stroke flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-neutral-200">
            <Activity className="w-3.5 h-3.5 text-brand" />
            <span>{lang === 'ar' ? 'مخطط الصرف السابق ونمط الالتزام:' : 'Refill Timeline & Adherence Pattern:'}</span>
          </div>

          {/* PDC Adherence Badge */}
          <div
            className={`px-2 py-0.5 rounded-[4px] border text-[11px] font-bold flex items-center gap-1 ${getStatusBadgeStyle(
              analysis.overallPattern
            )}`}
          >
            {analysis.overallPattern === 'optimal' ? (
              <CheckCircle2 className="w-3 h-3 text-success-fg" />
            ) : analysis.overallPattern === 'severe-irregular' ? (
              <AlertTriangle className="w-3 h-3 text-critical-fg" />
            ) : (
              <Clock className="w-3 h-3 text-warning-fg" />
            )}
            <span>
              {analysis.pdc}% {lang === 'ar' ? 'التزام (PDC)' : 'PDC Adherence'} •{' '}
              {lang === 'ar' ? analysis.patternTitleAr : analysis.patternTitleEn}
            </span>
          </div>

          {/* Metric count */}
          <span className="text-[11px] text-neutral-400">
            ({analysis.totalRefillsCount} {lang === 'ar' ? 'مرات صرف مسجلة' : 'dispenses logged'})
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onUpdateRefillHistory && (
            <button
              type="button"
              onClick={() => setShowAddForm(prev => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-blue-600/20 hover:bg-blue-600 text-brand hover:text-fg border border-brand text-[11px] font-bold transition-colors duration-150 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إضافة صرف سابق' : 'Add Past Refill'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 space-y-3.5">
          {/* Quick Add Past Refill Form (Inline Drawer) */}
          {showAddForm && onUpdateRefillHistory && (
            <form
              onSubmit={handleAddRefillDate}
              className="p-3 bg-canvas border border-brand rounded-[4px] space-y-2.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between font-bold text-brand text-xs">
                <span>{lang === 'ar' ? 'تسجيل تاريخ صرف دوائي سابق' : 'Record Previous Refill Event'}</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-neutral-400 hover:text-fg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400">
                    {lang === 'ar' ? 'تاريخ الصرف السابق' : 'Past Refill Date'}
                  </label>
                  <input
                    type="date"
                    value={inputDate}
                    max={formatYMD(new Date())}
                    onChange={e => setInputDate(e.target.value)}
                    className="w-full bg-surface border border-stroke p-1.5 rounded-[4px] text-fg text-xs font-mono outline-none focus:border-brand"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400">
                    {lang === 'ar' ? 'الكمية المصروفة (أيام)' : 'Days Supply'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={inputDaysSupply}
                    onChange={e => setInputDaysSupply(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-surface border border-stroke p-1.5 rounded-[4px] text-fg text-xs font-bold text-center outline-none focus:border-brand"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400">
                    {lang === 'ar' ? 'ملاحظة سريرية (اختياري)' : 'Clinical Note (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={inputNote}
                    placeholder={lang === 'ar' ? 'مثال: صرف مستشفى، شراء خاص...' : 'e.g. Hospital discharge'}
                    onChange={e => setInputNote(e.target.value)}
                    className="w-full bg-surface border border-stroke p-1.5 rounded-[4px] text-fg text-xs outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-neutral-800">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span>{lang === 'ar' ? 'اختصارات سريعة:' : 'Quick Presets:'}</span>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPreset(30)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] transition-colors"
                  >
                    -30 {lang === 'ar' ? 'يوم' : 'days'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPreset(60)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] transition-colors"
                  >
                    -60 {lang === 'ar' ? 'يوم' : 'days'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPreset(90)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] transition-colors"
                  >
                    -90 {lang === 'ar' ? 'يوم' : 'days'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-brand-subtle0 text-fg text-xs font-bold"
                  >
                    {lang === 'ar' ? 'حفظ الصرف السابق' : 'Save Event'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Visual Timeline Track */}
          <div className="relative overflow-x-auto pb-2 pt-1 scrollbar-thin">
            <div className="min-w-[620px] flex items-center justify-start gap-1 py-3 px-2">
              {analysis.events.map((event, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === analysis.events.length - 1;
                const nextEvent = analysis.events[idx + 1];

                // Gap status color styling
                let gapColor = 'border-success-border bg-success-bg0';
                let gapTextColor = 'text-success-fg';
                let gapBg = 'bg-success-bg border-success-border';

                if (event.status === 'minor-delay') {
                  gapColor = 'border-warning-border bg-warning-bg';
                  gapTextColor = 'text-warning-fg';
                  gapBg = 'bg-warning-bg border-warning-border';
                } else if (event.status === 'moderate-gap' || event.status === 'critical-gap') {
                  gapColor = 'border-critical-border bg-critical-bg0';
                  gapTextColor = 'text-critical-fg';
                  gapBg = 'bg-critical-bg border-critical-border';
                } else if (event.status === 'early') {
                  gapColor = 'border-purple-400 bg-purple-400';
                  gapTextColor = 'text-purple-300';
                  gapBg = 'bg-purple-950/40 border-purple-800/60';
                }

                return (
                  <React.Fragment key={event.id}>
                    {/* Node Card */}
                    <div className="flex flex-col items-center relative group shrink-0 w-36">
                      {/* Node Header Pill */}
                      <div
                        className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border mb-1 flex items-center gap-1 ${
                          isLast
                            ? 'bg-brand-subtle0/20 text-brand border-brand'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        <Calendar className="w-2.5 h-2.5" />
                        <span>
                          {isLast
                            ? lang === 'ar'
                              ? 'الصرف الحالي'
                              : 'Current Refill'
                            : `${lang === 'ar' ? 'صرف' : 'Refill'} #${idx + 1}`}
                        </span>
                      </div>

                      {/* Main Node Circle */}
                      <div
                        className={`w-9 h-9 rounded-[4px] flex items-center justify-center font-bold text-xs border-2  transition-transform group-hover:scale-105 z-10 ${
                          isLast
                            ? 'bg-blue-600 text-fg border-brand shadow-blue-900/50 ring-4 ring-blue-500/20'
                            : 'bg-subtle text-neutral-200 border-neutral-500'
                        }`}
                      >
                        <span>{idx + 1}</span>
                      </div>

                      {/* Date & Details under node */}
                      <div className="text-center mt-1.5 space-y-0.5">
                        <div className="font-mono font-bold text-neutral-100 text-xs">
                          {event.date}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-semibold">
                          {event.daysSupply} {lang === 'ar' ? 'يوم / حبة' : 'days supply'}
                        </div>
                        {event.note && (
                          <div className="text-[9px] text-warning-fg truncate max-w-[130px]" title={event.note}>
                            {event.note}
                          </div>
                        )}
                      </div>

                      {/* Delete button (for past manual records, not for primary current dispense) */}
                      {!isLast && onUpdateRefillHistory && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRefill(event.date)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-[4px] bg-critical-bg hover:bg-critical-bg0 text-fg text-[9px] absolute -top-1 right-2 transition-opacity shadow cursor-pointer"
                          title={lang === 'ar' ? 'حذف هذا التاريخ' : 'Remove this date'}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>

                    {/* Connecting Line with Adherence Gap / Interval Indicator */}
                    {nextEvent && (
                      <div className="flex-1 flex flex-col items-center justify-center px-1 relative min-w-[110px]">
                        {/* Gap Tag on connector */}
                        <div
                          className={`px-2 py-0.5 rounded border text-[9px] font-bold mb-1  whitespace-nowrap z-10 ${gapBg} ${gapTextColor}`}
                          title={lang === 'ar' ? event.statusLabelAr : event.statusLabelEn}
                        >
                          {event.daysToNext} {lang === 'ar' ? 'يوم فاصل' : 'days'}
                          {event.gapDays !== undefined && (
                            <span className="ml-1 font-mono">
                              ({event.gapDays > 0 ? `+${event.gapDays}` : event.gapDays} {lang === 'ar' ? 'يوم' : 'd'})
                            </span>
                          )}
                        </div>

                        {/* Connector Line */}
                        <div className="w-full relative flex items-center">
                          <div
                            className={`w-full h-1 rounded ${
                              event.gapDays && event.gapDays > 10 ? 'border-t-2 border-dashed border-critical-border' : gapColor
                            }`}
                          />
                          <div
                            className={`w-2 h-2 rounded-[4px] absolute right-1/2 translate-x-1/2 ${gapColor}`}
                          />
                        </div>

                        {/* Sub-label */}
                        <div className="text-[9px] text-neutral-400 mt-1 whitespace-nowrap">
                          {event.gapDays !== undefined && event.gapDays > 5 ? (
                            <span className="text-critical-fg font-bold flex items-center gap-0.5">
                              <span>⚠️</span>
                              <span>{lang === 'ar' ? 'فجوة انقطاع' : 'Therapy gap'}</span>
                            </span>
                          ) : event.gapDays !== undefined && event.gapDays < -3 ? (
                            <span className="text-purple-400 font-semibold">{lang === 'ar' ? 'صرف مبكر' : 'Early refill'}</span>
                          ) : (
                            <span className="text-success-fg font-medium">{lang === 'ar' ? 'منتظم' : 'Continuous'}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* If this is the last node, connect to the Future Target Node */}
                    {isLast && (
                      <>
                        <div className="flex-1 flex flex-col items-center justify-center px-1 relative min-w-[110px]">
                          {/* Next due badge */}
                          <div
                            className={`px-2 py-0.5 rounded border text-[9px] font-bold mb-1  whitespace-nowrap z-10 ${
                              analysis.isOverdueForRefill
                                ? 'bg-critical-bg border-critical-border text-critical-fg animate-pulse'
                                : 'bg-brand-subtle border-brand text-brand'
                            }`}
                          >
                            {analysis.isOverdueForRefill
                              ? `${lang === 'ar' ? 'متأخر بـ' : 'Overdue by'} ${analysis.overdueDays} ${lang === 'ar' ? 'يوم' : 'days'}`
                              : `${lang === 'ar' ? 'متبقي' : 'Due in'} ${analysis.daysUntilNextRefill} ${lang === 'ar' ? 'يوم' : 'days'}`}
                          </div>

                          {/* Line to future */}
                          <div className="w-full relative flex items-center">
                            <div
                              className={`w-full h-1 border-t-2 border-dashed ${
                                analysis.isOverdueForRefill ? 'border-critical-border' : 'border-brand'
                              }`}
                            />
                            <ArrowRight
                              className={`w-3.5 h-3.5 absolute right-0 ${
                                analysis.isOverdueForRefill ? 'text-critical-fg' : 'text-brand'
                              }`}
                            />
                          </div>

                          <div className="text-[9px] text-neutral-400 mt-1 whitespace-nowrap">
                            {lang === 'ar' ? 'تاريخ التكرار القادم' : 'Next Expected Refill'}
                          </div>
                        </div>

                        {/* Future Target Node */}
                        <div className="flex flex-col items-center relative shrink-0 w-36">
                          <div
                            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border mb-1 flex items-center gap-1 ${
                              analysis.isOverdueForRefill
                                ? 'bg-critical-bg0/20 text-critical-fg border-critical-border'
                                : 'bg-brand-subtle0/10 text-brand border-brand'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>{lang === 'ar' ? 'الموعد القادم' : 'Next Target'}</span>
                          </div>

                          <div
                            className={`w-9 h-9 rounded-[4px] flex items-center justify-center font-bold text-xs border-2 border-dashed z-10 ${
                              analysis.isOverdueForRefill
                                ? 'bg-critical-bg text-critical-fg border-critical-border ring-2 ring-rose-500/30'
                                : 'bg-surface text-brand border-brand'
                            }`}
                          >
                            <Calendar className="w-4 h-4" />
                          </div>

                          <div className="text-center mt-1.5 space-y-0.5">
                            <div className="font-mono font-bold text-neutral-200 text-xs">
                              {analysis.nextProjectedRefillDate}
                            </div>
                            <div
                              className={`text-[10px] font-bold ${
                                analysis.isOverdueForRefill ? 'text-critical-fg' : 'text-brand'
                              }`}
                            >
                              {analysis.isOverdueForRefill
                                ? `${lang === 'ar' ? 'مستحق منذ' : 'Overdue'} ${analysis.overdueDays}d`
                                : `${analysis.daysUntilNextRefill} ${lang === 'ar' ? 'يوم متبقي' : 'days left'}`}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Clinical Adherence Insight & Pattern Box */}
          <div
            className={`p-3 rounded-[4px] border flex items-start gap-3 ${
              analysis.overallPattern === 'optimal'
                ? 'bg-success-bg border-success-border text-success-fg'
                : analysis.overallPattern === 'severe-irregular'
                ? 'bg-critical-bg border-critical-border text-critical-fg'
                : analysis.overallPattern === 'early-overuse'
                ? 'bg-purple-950/25 border-purple-700/40 text-purple-200'
                : 'bg-warning-bg border-warning-border text-warning-fg'
            }`}
          >
            <div className="p-1.5 rounded-[4px] bg-black/30 shrink-0 mt-0.5">
              {analysis.overallPattern === 'optimal' ? (
                <CheckCircle2 className="w-4 h-4 text-success-fg" />
              ) : analysis.overallPattern === 'severe-irregular' ? (
                <AlertTriangle className="w-4 h-4 text-critical-fg" />
              ) : (
                <Clock className="w-4 h-4 text-warning-fg" />
              )}
            </div>

            <div className="space-y-1 flex-1">
              <div className="font-bold text-xs flex items-center justify-between">
                <span>
                  {lang === 'ar' ? 'التحليل السريري للالتزام الدوائي:' : 'Clinical Adherence Assessment:'}{' '}
                  <span className="font-black underline">
                    {lang === 'ar' ? analysis.patternTitleAr : analysis.patternTitleEn}
                  </span>
                </span>

                {analysis.maxGapDays > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-neutral-700">
                    {lang === 'ar' ? `أقصى فجوة: +${analysis.maxGapDays} يوم` : `Max Gap: +${analysis.maxGapDays}d`}
                  </span>
                )}
              </div>

              <p className="text-[11px] leading-relaxed opacity-95">
                {lang === 'ar' ? analysis.clinicalInsightAr : analysis.clinicalInsightEn}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
