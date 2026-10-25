import React, { useState } from 'react';
import {
  Stethoscope,
  Plus,
  MessageSquare,
  Send,
  CheckCircle,
  Trash2,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { FollowUpEntry, Patient } from '../../types/pharmacy';
import { formatPhoneForWhatsApp, executeUniversalSMS } from '../../utils/pharmacyCalculations';

interface FollowUpViewProps {
  followUps: FollowUpEntry[];
  patients: Patient[];
  pharmacyName: string;
  waAbxTemplate: string;
  waChronicFollowTemplate: string;
  lang: 'ar' | 'en';
  onOpenFollowUpModal: () => void;
  onResolveFollowUp: (id: string) => void;
  onDeleteFollowUp: (id: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const FollowUpView: React.FC<FollowUpViewProps> = ({
  followUps,
  patients,
  pharmacyName,
  waAbxTemplate,
  waChronicFollowTemplate,
  lang,
  onOpenFollowUpModal,
  onResolveFollowUp,
  onDeleteFollowUp,
  onShowToast,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filtered = followUps.filter(f => {
    if (filterType === 'ACTIVE') return !f.resolved;
    if (filterType === 'RESOLVED') return f.resolved;
    if (filterType === 'ANTIBIOTIC') return f.type === 'ANTIBIOTIC';
    if (filterType === 'CHRONIC') return f.type !== 'ANTIBIOTIC';
    return true;
  });

  const handleSendWhatsApp = (item: FollowUpEntry) => {
    let template = item.type === 'ANTIBIOTIC' ? waAbxTemplate : waChronicFollowTemplate;
    if (!template) {
      template =
        item.type === 'ANTIBIOTIC'
          ? 'مرحباً {name}، معك دكتور الصيدلة من {pharmacy}. نود الاطمئنان على استجابتك لمضاد ({drug}). نؤكد على ضرورة إكمال الكورس كاملاً.'
          : 'مرحباً {name}، معك دكتور الصيدلة من {pharmacy}. نود الاطمئنان على صحتك مع علاج ({drug}) وهل واجهت أي أعراض جانبية؟';
    }

    const message = template
      .replace('{name}', item.patientName)
      .replace('{pharmacy}', pharmacyName)
      .replace('{drug}', item.drug)
      .replace('{date}', item.dueDate);

    const cleanPhone = formatPhoneForWhatsApp(item.phone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    onShowToast(lang === 'ar' ? `تم فتح WhatsApp لمتابعة ${item.patientName}` : `Opened WhatsApp for ${item.patientName}`, 'success');
  };

  const handleSendSMS = (item: FollowUpEntry) => {
    const text = `${pharmacyName}: مرحباً ${item.patientName}، نود الاطمئنان على استجابتك لعلاج ${item.drug}. صحتكم تهمنا دائماً.`;
    executeUniversalSMS(item.phone, text);
    onShowToast(lang === 'ar' ? `تم إرسال استفسار SMS إلى ${item.patientName}` : `Sent SMS to ${item.patientName}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header and Explanation */}
      <div className="bg-surface border border-stroke rounded-[4px] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-extrabold text-lg text-fg flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-warning-fg" />
              <span>{lang === 'ar' ? 'مركز المتابعة السريرية ورعاية المضادات الحيوية' : 'Clinical Follow-Up & Antimicrobial Stewardship'}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 max-w-3xl leading-relaxed">
              {lang === 'ar'
                ? 'متابعة دورية منهجية: اليوم 3 واليوم 7 للمضادات الحيوية لضمان إكمال الكورس ومنع المقاومة الجرثومية؛ واليوم 3 و14 و30 للأدوية المزمنة الجديدة لرصد الآثار الجانبية ومعايرة الجرعات.'
                : 'Systematic clinical milestones: Day 3 & Day 7 for antibiotics to prevent bacterial resistance; Day 3, 14 & 30 for new chronic therapies to monitor tolerance and dose titration.'}
            </p>
          </div>

          <button
            onClick={onOpenFollowUpModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إضافة حالة متابعة جديدة' : 'Add Follow-Up'}</span>
          </button>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-stroke overflow-x-auto">
          {[
            { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            { id: 'ACTIVE', labelAr: 'قيد المتابعة فقط', labelEn: 'Active Only' },
            { id: 'ANTIBIOTIC', labelAr: 'المضادات الحيوية (Stewardship)', labelEn: 'Antibiotics' },
            { id: 'CHRONIC', labelAr: 'العلاجات المزمنة الجديدة', labelEn: 'Chronic Therapies' },
            { id: 'RESOLVED', labelAr: 'المكتملة والمستقرة', labelEn: 'Resolved' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold whitespace-nowrap transition-colors ${
                filterType === f.id
                  ? 'bg-warning-bg text-warning-fg border border-warning-border'
                  : 'bg-neutral-800 text-neutral-400 hover:text-fg'
              }`}
            >
              {lang === 'ar' ? f.labelAr : f.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-stroke rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs">
            <thead className="bg-subtle text-neutral-300 font-bold border-b border-stroke">
              <tr>
                <th className="py-3 px-4">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'نوع المتابعة' : 'Category'}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'العلاج / الدواء' : 'Target Medication'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'موعد المتابعة' : 'Milestone Due'}</th>
                <th className="py-3 px-3">{lang === 'ar' ? 'الحالة السريرية' : 'Status'}</th>
                <th className="py-3 px-4 text-center">{lang === 'ar' ? 'إجراءات التواصل' : 'Clinical Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke text-neutral-200">
              {followUps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-neutral-400">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-[4px] bg-brand-subtle text-brand border border-brand flex items-center justify-center mx-auto shadow-inner">
                        <Stethoscope className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-sm text-fg">
                        {lang === 'ar' ? 'سجل المتابعات السريرية فارغ' : 'No Follow-Ups Yet'}
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {lang === 'ar'
                          ? 'تم حذف البيانات النموذجية. يمكنك جدولة مواعيد متابعة للمضادات الحيوية (اليوم 3/7) أو مراقبة استقرار الأدوية المزمنة.'
                          : 'Sample follow-ups removed. Schedule antibiotic stewardship checks or chronic titration follow-ups.'}
                      </p>
                      <button
                        onClick={onOpenFollowUpModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[4px] text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand transition-colors duration-150 cursor-pointer mt-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'تسجيل متابعة سريرية جديدة' : 'Add First Follow-Up'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-400">
                    {lang === 'ar' ? 'لا توجد حالات متابعة مسجلة مطابقة للفلتر.' : 'No clinical follow-ups found.'}
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const nowYMD = new Date().toISOString().split('T')[0];
                  const isDue = item.dueDate <= nowYMD;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        !item.resolved && isDue ? 'bg-warning-bg' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-fg">
                        {item.patientName}
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-400">
                        {item.phone}
                      </td>
                      <td className="py-3 px-3">
                        {item.type === 'ANTIBIOTIC' ? (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-critical-bg text-critical-fg border border-critical-border">
                            <span>💊</span>
                            <span>{lang === 'ar' ? 'مضاد حيوي' : 'Antibiotic'}</span>
                          </span>
                        ) : item.type === 'CHRONIC_INIT' ? (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-brand-subtle text-brand border border-brand">
                            <span>🩺</span>
                            <span>{lang === 'ar' ? 'علاج مزمن جديد' : 'New Therapy'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-purple-950/60 text-purple-300 border border-purple-800/40">
                            <span>⚖️</span>
                            <span>{lang === 'ar' ? 'معايرة جرعة' : 'Titration'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-fg">{item.drug}</strong>
                        {item.notes && (
                          <div className="text-[11px] text-neutral-400 mt-0.5 max-w-xs truncate">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-fg">
                          {item.dueDate}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {lang === 'ar' ? `مرحلة اليوم ${item.daysOffset}` : `Day ${item.daysOffset} milestone`}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {item.resolved ? (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-success-bg text-success-fg border border-success-border">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تمت المتابعة والاستقرار' : 'Resolved'}</span>
                          </span>
                        ) : isDue ? (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-critical-bg text-critical-fg border border-critical-border animate-pulse">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'مستحقة المتابعة الآن' : 'Due Today'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-400 border border-neutral-700">
                            <span>قيد الانتظار</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleSendWhatsApp(item)}
                            title={lang === 'ar' ? 'إرسال استفسار سريري عبر WhatsApp' : 'Send WhatsApp Check-in'}
                            className="p-1.5 rounded-[4px] bg-success-bg hover:bg-success-bg text-success-fg hover:text-fg border border-success-border transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSendSMS(item)}
                            title={lang === 'ar' ? 'إرسال استفسار سريري عبر SMS' : 'Send SMS'}
                            className="p-1.5 rounded-[4px] bg-brand/20 hover:bg-brand text-brand hover:text-fg border border-brand transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          {!item.resolved && (
                            <button
                              onClick={() => onResolveFollowUp(item.id)}
                              title={lang === 'ar' ? 'تحديد كمكتملة ومستقرة' : 'Mark as Resolved'}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[4px] bg-success-bg text-success-fg border border-success-border hover:bg-success-bg text-xs font-bold transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تم التقييم' : 'Resolve'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteFollowUp(item.id)}
                            title={lang === 'ar' ? 'حذف السجل' : 'Delete'}
                            className="p-1.5 rounded-[4px] bg-neutral-800 text-neutral-400 hover:text-critical-fg border border-neutral-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
