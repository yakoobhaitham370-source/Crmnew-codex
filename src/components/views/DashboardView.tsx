import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, MessageSquare, Plus, Search, Stethoscope, Zap, ShieldAlert, Send } from 'lucide-react';
import type { Patient, FollowUpEntry, RefillReservation } from '../../types/pharmacy';
import { formatPhoneForWhatsApp, executeUniversalSMS } from '../../utils/pharmacyCalculations';
import { buildWorkQueue, matchesQueueRange, type QueueRange, type QueueKind, type WorkItem } from '../../utils/workQueue';
import { localDateKey, normalizeDigits, validatePatientRecord } from '../../utils/patientRecords';

interface DashboardViewProps {
  patients: Patient[];
  followUps: FollowUpEntry[];
  reservations: RefillReservation[];
  onOpenReservations: (patientId?: string, medIndex?: number, reservationId?: string) => void;
  pharmacyName: string;
  waTemplate: string;
  smsTemplate: string;
  lang: 'ar' | 'en';
  onOpenPatientModal: (patientId?: string, tab?: string) => void;
  onOpenRefillModal: (patientId: string, medIndex?: number) => void;
  onOpenFollowUpModal: () => void;
  onResolveFollowUp: (id: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const button = 'inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-stroke px-2.5 py-1.5 text-xs font-semibold hover:bg-hover';
const badge = 'inline-flex rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold';

export const DashboardView: React.FC<DashboardViewProps> = ({ patients, followUps, reservations, onOpenReservations, pharmacyName, waTemplate, smsTemplate, lang, onOpenPatientModal, onOpenRefillModal, onOpenFollowUpModal, onResolveFollowUp, onShowToast }) => {
  const ar = lang === 'ar';
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [today, setToday] = useState(localDateKey);
  const [range, setRange] = useState<QueueRange>('today');
  const [kind, setKind] = useState<QueueKind>('all');
  const [query, setQuery] = useState('');
  const [confirmFollowUp, setConfirmFollowUp] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDateKey()), 30000);
    const refresh = () => setToday(localDateKey());
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const items = useMemo(() => buildWorkQueue(patients, followUps, today, reservations), [patients, followUps, today, reservations]);
  const ranges: { id: QueueRange; en: string; ar: string }[] = [
    { id: 'overdue', en: 'Overdue', ar: 'متأخر' },
    { id: 'today', en: 'Today', ar: 'اليوم' },
    { id: 'week', en: 'Next 7 days', ar: 'الأيام السبعة القادمة' },
    { id: 'completed', en: 'Completed today', ar: 'مكتمل اليوم' },
  ];
  const normalizedQuery = normalizeDigits(query.trim().toLocaleLowerCase());
  const matchesSearch = (item: WorkItem) => normalizeDigits([item.patient.name, item.patient.id, item.patient.phone, formatPhoneForWhatsApp(item.patient.phone), item.patient.familyTag, item.title].join(' ').toLocaleLowerCase()).includes(normalizedQuery);
  const scoped = items.filter(item => (kind === 'all' || item.kind === kind) && matchesSearch(item));
  const visible = scoped.filter(item => matchesQueueRange(item, range));
  const reviewPatients = patients.filter(p => !p.isArchived && validatePatientRecord(p, today).length > 0);
  const pendingConfirm = visible.find(item => item.followUpId === confirmFollowUp);

  const openReminder = (item: WorkItem, channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    const template = item.kind === 'refill' ? (channel === 'sms' ? smsTemplate : waTemplate) : text('Hello {name}, {pharmacy} is following up on your treatment with {drug}. Please contact us.', 'مرحباً {name}، معك {pharmacy}. نود الاطمئنان على علاجك {drug}. يرجى التواصل معنا.');
    const invitation = item.kind === 'refill' ? text(' Reply to reserve your refill and agree on a pickup date.', ' ردّ على هذه الرسالة لحجز الصرف وتحديد موعد الاستلام.') : '';
    const message = (template || '{pharmacy}: {name}, {drug}, {date}')
      .replaceAll('{name}', item.patient.name).replaceAll('{pharmacy}', pharmacyName).replaceAll('{drug}', item.title).replaceAll('{date}', item.dueDate) + invitation;
    if (channel === 'sms') {
      executeUniversalSMS(normalizeDigits(item.patient.phone), message);
      onShowToast(text('SMS prepared. Delivery is not confirmed.', 'تم تجهيز SMS. لم يتم تأكيد الإرسال.'), 'info');
      return;
    }
    window.open(`https://wa.me/${formatPhoneForWhatsApp(normalizeDigits(item.patient.phone))}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    onShowToast(text('WhatsApp opened. Delivery is not confirmed.', 'تم فتح WhatsApp. لم يتم تأكيد الإرسال.'), 'info');
  };

  return (
    <div className="fluent-dashboard space-y-3">
      <section className="bg-surface border border-stroke rounded-[4px]">
        <div className="p-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">{text('Daily work queue', 'قائمة العمل اليومية')}</h1>
            <p className="text-xs text-muted mt-1">{text('Refills and clinical follow-ups, ordered by due date.', 'الصرف والمتابعات السريرية مرتبة حسب تاريخ الاستحقاق.')} <time className="font-mono" dateTime={today}>{today}</time></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => onOpenReservations()}>{text('Reservations', 'الحجوزات')}</button>
            <button className={button} onClick={onOpenFollowUpModal}><Stethoscope className="size-3.5" />{text('Add follow-up', 'إضافة متابعة')}</button>
            <button className={`${button} bg-brand text-on-brand border-brand`} onClick={() => onOpenPatientModal()}><Plus className="size-3.5" />{text('New patient', 'مريض جديد')}</button>
          </div>
        </div>
        <div className="flex overflow-x-auto border-t border-stroke px-3" role="group" aria-label={text('Due date filter', 'تصفية حسب الاستحقاق')}>
          {ranges.map(tab => <button key={tab.id} aria-pressed={range === tab.id} onClick={() => { setRange(tab.id); setConfirmFollowUp(null); }} className={`flex items-center gap-2 whitespace-nowrap px-3 py-2.5 border-b-[3px] text-xs font-semibold ${range === tab.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:bg-hover'}`}>
            {text(tab.en, tab.ar)}<span className="font-mono bg-subtle text-fg px-1.5 py-0.5 rounded-[4px]">{scoped.filter(item => matchesQueueRange(item, tab.id)).length}</span>
          </button>)}
        </div>
        <div className="p-3 flex flex-wrap gap-2 items-center border-t border-stroke">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="size-3.5 absolute start-2.5 top-2.5 text-muted pointer-events-none" />
            <input type="search" aria-label={text('Search work queue', 'البحث في قائمة العمل')} placeholder={text('Search name, phone, medication or ID', 'ابحث بالاسم أو الهاتف أو الدواء أو الرمز')} value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-canvas border border-stroke rounded-[4px] ps-8 pe-3 py-2 text-xs" />
          </div>
          <div role="group" aria-label={text('Task type', 'نوع المهمة')} className="flex gap-1">
            {(['all', 'refill', 'followup', 'reservation'] as const).map(type => <button key={type} aria-pressed={kind === type} onClick={() => { setKind(type); setConfirmFollowUp(null); }} className={`${button} ${kind === type ? 'bg-brand-subtle text-brand border-brand' : ''}`}>{type === 'all' ? text('All tasks', 'كل المهام') : type === 'refill' ? text('Refills', 'الصرف') : type === 'reservation' ? text('Reservations', 'الحجوزات') : text('Follow-ups', 'المتابعات')}</button>)}
          </div>
        </div>
      </section>

      {reviewPatients.length > 0 && <section className="border border-warning-border bg-warning-bg text-warning-fg p-3 rounded-[4px] text-xs flex flex-wrap gap-2 items-center">
        <ShieldAlert className="size-4 shrink-0" /><strong>{text('Records need review:', 'ملفات تحتاج مراجعة:')} <span className="font-mono">{reviewPatients.length}</span></strong>
        <span>{text('Invalid medication schedules are excluded from the queue.', 'لا تظهر مواعيد الأدوية غير الصحيحة في القائمة.')}</span>
        {reviewPatients.slice(0, 3).map(p => <button className="underline underline-offset-2 font-semibold" key={p.id} onClick={() => onOpenPatientModal(p.id)}>{p.name || p.id}</button>)}
      </section>}

      <section className="bg-surface border border-stroke rounded-[4px] overflow-hidden" aria-label={text('Work queue results', 'نتائج قائمة العمل')}>
        <div className="section-header border-b border-stroke flex items-center justify-between text-xs">
          <h2 className="font-semibold">{text(ranges.find(tab => tab.id === range)!.en, ranges.find(tab => tab.id === range)!.ar)}</h2>
          <span role="status" className="text-muted">{visible.length} {text('tasks', 'مهمة')}</span>
        </div>
        {pendingConfirm && <div role="alert" className="m-3 p-3 rounded-[4px] border border-warning-border bg-warning-bg text-warning-fg text-xs flex flex-wrap items-center gap-2">
          <span>{text('Confirm this clinical follow-up is complete:', 'تأكيد اكتمال المتابعة السريرية:')} <strong>{pendingConfirm.patient.name} · {pendingConfirm.title}</strong></span>
          <button className={button} onClick={() => { onResolveFollowUp(pendingConfirm.followUpId!); setConfirmFollowUp(null); }}>{text('Confirm completion', 'تأكيد الاكتمال')}</button>
          <button className={button} onClick={() => setConfirmFollowUp(null)}>{text('Cancel', 'إلغاء')}</button>
        </div>}
        {visible.length === 0 ? <div className="p-8 text-center space-y-2">
          <CheckCircle2 className="size-6 mx-auto text-muted" />
          <h3 className="font-semibold text-sm">{text('No tasks in this view', 'لا توجد مهام في هذا العرض')}</h3>
          <p className="text-xs text-muted">{query || kind !== 'all' ? text('Try another search or task type.', 'جرّب بحثاً أو نوع مهمة آخر.') : text('Check another date range, or add a patient or follow-up.', 'اختر فترة أخرى أو أضف مريضاً أو متابعة.')}</p>
          {(query || kind !== 'all') && <button className={button} onClick={() => { setQuery(''); setKind('all'); }}>{text('Clear filters', 'مسح التصفية')}</button>}
        </div> : <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-subtle border-b border-stroke"><tr>
              {[text('Patient', 'المريض'), text('Task / treatment', 'المهمة / العلاج'), text('Due date', 'الاستحقاق'), text('Priority', 'الأولوية'), text('Record alerts', 'تنبيهات الملف'), text('Actions', 'الإجراءات')].map(label => <th key={label} scope="col">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-stroke">
              {visible.map(item => <tr key={item.id}>
                <td><button className="font-semibold text-brand hover:underline" onClick={() => onOpenPatientModal(item.patient.id)}>{item.patient.name}</button><div className="text-muted font-mono text-[11px] mt-1" dir="ltr">{item.patient.phone}</div><div className="text-muted font-mono text-[10px]">{item.patient.id}</div></td>
                <td><div className="font-semibold">{item.title}</div><div className="text-muted mt-1">{item.kind === 'refill' ? text('Medication refill', 'تكرار صرف') : item.kind === 'reservation' ? text('Reserved pickup', 'استلام حجز') : text('Clinical follow-up', 'متابعة سريرية')}{item.detail ? ` · ${item.kind === 'reservation' ? ({requested: text('Requested', 'مطلوب'), stock_checked: text('Stock checked', 'تم فحص المخزون'), ready: text('Ready', 'جاهز'), collected: text('Collected', 'تم الاستلام')} as Record<string, string>)[item.detail] : item.detail}` : ''}</div></td>
                <td><time dateTime={item.dueDate} className="font-mono whitespace-nowrap">{item.dueDate}</time></td>
                <td><span className={`${badge} ${item.completed ? 'bg-success-bg text-success-fg border-success-border' : item.daysRemaining < 0 ? 'bg-critical-bg text-critical-fg border-critical-border' : 'bg-warning-bg text-warning-fg border-warning-border'}`}>{item.completed ? text('Completed', 'مكتمل') : item.daysRemaining < 0 ? text(`${-item.daysRemaining}d overdue`, `متأخر ${-item.daysRemaining} يوم`) : item.daysRemaining === 0 ? text('Due today', 'مستحق اليوم') : text(`In ${item.daysRemaining}d`, `خلال ${item.daysRemaining} يوم`)}</span></td>
                <td><span className={`text-[11px] ${item.patient.allergies?.trim() ? 'text-fg' : 'text-warning-fg'}`}>{item.patient.allergies?.trim() || text('Allergies not recorded', 'الحساسيات غير مسجلة')}</span></td>
                <td><div className="flex gap-1.5 items-center whitespace-nowrap">
                  <button className={button} title={text('Open patient record', 'فتح ملف المريض')} aria-label={`${text('Open record', 'فتح الملف')}: ${item.patient.name}`} onClick={() => onOpenPatientModal(item.patient.id, item.kind === 'refill' ? 'regimen' : 'demographics')}><FileText className="size-3.5" /></button>
                  {item.kind === 'reservation' && <button className={`${button} text-brand`} onClick={() => onOpenReservations(undefined, undefined, item.reservationId)}>{text('Manage reservation', 'إدارة الحجز')}</button>}
                  {!item.completed && item.kind !== 'reservation' && <>
                    <button className={button} disabled={!/^\d{8,15}$/.test(formatPhoneForWhatsApp(normalizeDigits(item.patient.phone)))} title={text('Prepare WhatsApp reminder', 'تجهيز تذكير WhatsApp')} aria-label={`${text('Prepare reminder', 'تجهيز تذكير')}: ${item.patient.name}`} onClick={() => openReminder(item)}><MessageSquare className="size-3.5" /></button>
                    <button className={button} disabled={!/^\d{8,15}$/.test(formatPhoneForWhatsApp(normalizeDigits(item.patient.phone)))} title={text('Prepare SMS reminder', 'تجهيز تذكير SMS')} aria-label={`${text('Prepare SMS', 'تجهيز SMS')}: ${item.patient.name}`} onClick={() => openReminder(item, 'sms')}><Send className="size-3.5" /></button>
                    {item.kind === 'refill' && <button className={button} onClick={() => onOpenReservations(item.patient.id, item.medicationIndex)}>{text('Reserve', 'حجز')}</button>}
                    <button className={`${button} bg-brand text-on-brand border-brand`} onClick={() => item.kind === 'refill' ? onOpenRefillModal(item.patient.id, item.medicationIndex) : setConfirmFollowUp(item.followUpId!)}>{item.kind === 'refill' ? <Zap className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}{item.kind === 'refill' ? text('Refill', 'صرف') : text('Complete', 'إكمال')}</button>
                  </>}
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </section>
      <p className="text-[11px] text-muted">{text('Counts represent tasks, not unique patients. Opening a reminder does not mark it as sent or complete.', 'الأعداد تمثل المهام وليس عدد المرضى. فتح التذكير لا يؤكد إرساله ولا يُكمل المهمة.')}</p>
    </div>
  );
};
