import React, { useState } from 'react';
import {
  CalendarDays,
  Check,
  ClipboardList,
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type {
  Patient,
  RefillReservation,
  ReservationStatus,
} from '../../types/pharmacy';
import {
  isOpenReservation,
  reservationRecordChanged,
} from '../../utils/reservations';
import {
  isValidPatientPhone,
  localDateKey,
  normalizeDigits,
} from '../../utils/patientRecords';
import { formatPhoneForWhatsApp } from '../../utils/pharmacyCalculations';

interface Props {
  reservations: RefillReservation[];
  patients: Patient[];
  lang: 'ar' | 'en';
  pharmacyName: string;
  storageError: boolean;
  initialPatientId?: string;
  initialMedIndex?: number;
  initialReservationId?: string;
  onCreate: (
    patientId: string,
    medicationIndices: number[],
    pickupDate: string,
    source: RefillReservation['source'],
    notes: string,
  ) => boolean;
  onAdvance: (id: string, status: ReservationStatus, note?: string) => boolean;
  onReschedule: (id: string, pickupDate: string) => boolean;
  onCollect: (id: string, supplies: Record<string, number>) => boolean;
  onOpenPatient: (patientId: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const button =
  'inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-stroke px-2.5 py-1.5 text-xs font-semibold hover:bg-hover disabled:opacity-50';
const input =
  'w-full rounded-[4px] border border-stroke bg-canvas px-2.5 py-2 text-xs';
const stages: ReservationStatus[] = [
  'requested',
  'stock_checked',
  'ready',
  'collected',
];

export function ReservationsView({
  reservations,
  patients,
  lang,
  pharmacyName,
  storageError,
  initialPatientId,
  initialMedIndex,
  initialReservationId,
  onCreate,
  onAdvance,
  onReschedule,
  onCollect,
  onOpenPatient,
  onShowToast,
}: Props) {
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const labels: Record<ReservationStatus, string> = {
    requested: text('Requested', 'مطلوب'),
    stock_checked: text('Stock checked', 'تم فحص المخزون'),
    ready: text('Ready', 'جاهز'),
    collected: text('Collected', 'تم الاستلام'),
    cancelled: text('Cancelled', 'ملغى'),
  };
  const [filter, setFilter] = useState<ReservationStatus | 'open' | 'all'>(
    'open',
  );
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(Boolean(initialPatientId));
  const [patientQuery, setPatientQuery] = useState('');
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [indices, setIndices] = useState<number[]>(
    initialMedIndex === undefined ? [] : [initialMedIndex],
  );
  const [pickupDate, setPickupDate] = useState(localDateKey);
  const [source, setSource] = useState<RefillReservation['source']>('whatsapp');
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState(initialReservationId || '');
  const [stockConfirmed, setStockConfirmed] = useState(false);
  const [collectConfirmed, setCollectConfirmed] = useState(false);
  const [supplies, setSupplies] = useState<Record<string, number>>({});
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [newDate, setNewDate] = useState('');
  const selected = reservations.find((r) => r.id === selectedId);
  const patient = patients.find((p) => p.id === patientId && !p.isArchived);
  const currentPatient = patients.find((p) => p.id === selected?.patientId);
  const recordChanged = Boolean(
    selected &&
      currentPatient &&
      reservationRecordChanged(selected, currentPatient),
  );
  const patientAvailable = Boolean(
    currentPatient && !currentPatient.isArchived,
  );
  const searchKey = normalizeDigits(query.trim().toLocaleLowerCase());
  const searched = reservations.filter((r) =>
    normalizeDigits(
      [
        r.patientName,
        r.phone,
        formatPhoneForWhatsApp(normalizeDigits(r.phone)),
        r.id,
        ...r.medications.map((m) => m.name),
      ]
        .join(' ')
        .toLocaleLowerCase(),
    ).includes(searchKey),
  );
  const matches = (r: RefillReservation, status: typeof filter) =>
    status === 'all' ||
    (status === 'open' ? isOpenReservation(r) : r.status === status);
  const visible = searched
    .filter((r) => matches(r, filter))
    .sort(
      (a, b) =>
        a.pickupDate.localeCompare(b.pickupDate) ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const sourceLabel = (s: RefillReservation['source']) =>
    s === 'whatsapp'
      ? 'WhatsApp'
      : s === 'phone'
        ? text('Phone', 'اتصال هاتفي')
        : text('In person', 'حضور شخصي');
  const open = (r: RefillReservation) => {
    setSelectedId(r.id);
    setStockConfirmed(false);
    setCollectConfirmed(false);
    setShowCancel(false);
    setCancelReason('');
    setNewDate(r.pickupDate);
    setSupplies(
      Object.fromEntries(
        r.medications.map((m) => [m.medicationId, m.daysSupply]),
      ),
    );
  };
  const readyMessage = () => {
    if (!selected) return;
    const phone = currentPatient?.phone || selected.phone;
    const message = text(
      `Hello ${currentPatient?.name || selected.patientName}, your refill reservation at ${pharmacyName} is ready for pickup on ${selected.pickupDate}. Please contact us if your plans change.`,
      `مرحباً ${currentPatient?.name || selected.patientName}، حجز الصرف لدى ${pharmacyName} جاهز للاستلام بتاريخ ${selected.pickupDate}. يرجى التواصل معنا عند تغيير موعدكم.`,
    );
    window.open(
      `https://wa.me/${formatPhoneForWhatsApp(normalizeDigits(phone))}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
    onShowToast(
      text(
        'Pickup message prepared. Sending and delivery are not confirmed.',
        'تم تجهيز رسالة الاستلام. لم يتم تأكيد الإرسال أو التسليم.',
      ),
      'info',
    );
  };
  const nextStage =
    selected?.status === 'requested' ? 'stock_checked' : 'ready';

  return (
    <div className="space-y-3">
      <section className="bg-surface border border-stroke rounded-[4px] p-3 space-y-3">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h1 className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="size-4 text-brand" />
              {text('Refill reservations', 'حجوزات الصرف')}
            </h1>
            <p className="text-xs text-muted mt-1">
              {text(
                'Record a patient’s reply, check availability and prepare their pickup.',
                'سجّل رد المريض وتحقق من توفر الأدوية وجهّز موعد الاستلام.',
              )}
            </p>
          </div>
          <button
            className={`${button} bg-brand text-on-brand`}
            disabled={storageError}
            onClick={() => {
              setShowCreate(true);
              setSelectedId('');
            }}
          >
            <Plus className="size-3.5" />
            {text('Record request', 'تسجيل طلب')}
          </button>
        </div>
        <p className="text-[11px] text-muted">
          {text(
            'Staff enter WhatsApp, phone and in-person replies. Reservations are saved on this browser and included in JSON backups; Google Sheets sync does not include them.',
            'يسجّل الموظف الردود عبر WhatsApp والهاتف والحضور. تُحفظ الحجوزات على هذا المتصفح وتُضمّن في النسخ الاحتياطية JSON، ولا تشملها مزامنة Google Sheets.',
          )}
        </p>
        {storageError && (
          <p
            role="alert"
            className="border border-critical-border bg-critical-bg text-critical-fg p-2 rounded-[4px] text-xs"
          >
            {text(
              'Saved reservations could not be read. Restore a valid backup in Settings before making changes.',
              'تعذّر قراءة الحجوزات المحفوظة. استعد نسخة احتياطية صحيحة من الإعدادات قبل إجراء تغييرات.',
            )}
          </p>
        )}
      </section>

      {showCreate && (
        <section
          aria-labelledby="reservation-create-title"
          className="bg-surface border border-stroke rounded-[4px]"
        >
          <div className="flex items-center justify-between p-3 border-b border-stroke">
            <h2 id="reservation-create-title" className="text-sm font-semibold">
              {text('Record refill request', 'تسجيل طلب صرف')}
            </h2>
            <button
              className={button}
              aria-label={text('Close request form', 'إغلاق نموذج الطلب')}
              onClick={() => setShowCreate(false)}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <form
            className="p-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (onCreate(patientId, indices, pickupDate, source, notes)) {
                setShowCreate(false);
                setIndices([]);
                setNotes('');
              }
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label
                  className="block text-xs font-semibold"
                  htmlFor="reservation-patient-search"
                >
                  {text('Find patient', 'البحث عن مريض')}
                </label>
                <input
                  id="reservation-patient-search"
                  type="search"
                  className={input}
                  placeholder={text('Name or phone', 'الاسم أو الهاتف')}
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
                <label
                  className="block text-xs font-semibold"
                  htmlFor="reservation-patient"
                >
                  {text('Patient', 'المريض')} *
                </label>
                <select
                  id="reservation-patient"
                  required
                  className={input}
                  value={patientId}
                  onChange={(e) => {
                    setPatientId(e.target.value);
                    setIndices([]);
                  }}
                >
                  <option value="">
                    {text('Select patient', 'اختر مريضاً')}
                  </option>
                  {patients
                    .filter(
                      (p) =>
                        !p.isArchived &&
                        (p.id === patientId ||
                          normalizeDigits(
                            `${p.name} ${p.phone}`.toLocaleLowerCase(),
                          ).includes(
                            normalizeDigits(patientQuery.toLocaleLowerCase()),
                          )),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.phone}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="reservation-pickup"
                  className="block text-xs font-semibold"
                >
                  {text('Pickup date', 'تاريخ الاستلام')} *
                </label>
                <input
                  id="reservation-pickup"
                  type="date"
                  required
                  min={localDateKey()}
                  className={input}
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                />
                <label
                  htmlFor="reservation-source"
                  className="block text-xs font-semibold"
                >
                  {text('Patient replied via', 'مصدر رد المريض')}
                </label>
                <select
                  id="reservation-source"
                  className={input}
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof source)}
                >
                  {(['whatsapp', 'phone', 'in_person'] as const).map((s) => (
                    <option key={s} value={s}>
                      {sourceLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {patient && (
              <fieldset className="border border-stroke rounded-[4px] p-3 space-y-2">
                <legend className="text-xs font-semibold px-1">
                  {text('Medicines requested', 'الأدوية المطلوبة')} *
                </legend>
                {!patient.medications.some((m) => m.name.trim()) && (
                  <p className="text-xs text-warning-fg">
                    {text(
                      'Add medicines to the patient record before reserving.',
                      'أضف الأدوية إلى ملف المريض قبل الحجز.',
                    )}
                  </p>
                )}
                {patient.medications.map(
                  (med, index) =>
                    med.name.trim() && (
                      <label
                        key={med.id || index}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={indices.includes(index)}
                          onChange={(e) =>
                            setIndices((previous) =>
                              e.target.checked
                                ? [...previous, index]
                                : previous.filter((i) => i !== index),
                            )
                          }
                        />
                        <span className="font-semibold">{med.name}</span>
                        <span className="text-muted">
                          {med.daysSupply} {text('days', 'يوم')}
                        </span>
                      </label>
                    ),
                )}
                <p className="text-[11px] text-muted">
                  {text(
                    'Availability is confirmed in the next stage. No stock is deducted by creating a reservation.',
                    'يُؤكّد التوفر في المرحلة التالية. إنشاء الحجز لا يخصم من المخزون.',
                  )}
                </p>
              </fieldset>
            )}
            <label className="block space-y-1 text-xs font-semibold">
              {text('Request notes (optional)', 'ملاحظات الطلب (اختياري)')}
              <textarea
                rows={2}
                maxLength={1000}
                className={`${input} font-normal`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className={`${button} bg-brand text-on-brand`}
                disabled={!patient || !indices.length || storageError}
              >
                {text('Save requested reservation', 'حفظ الحجز المطلوب')}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => setShowCreate(false)}
              >
                {text('Cancel', 'إلغاء')}
              </button>
            </div>
          </form>
        </section>
      )}

      {selected && (
        <section
          aria-labelledby="reservation-detail-title"
          className="bg-surface border border-brand rounded-[4px]"
        >
          <div className="p-3 border-b border-stroke flex flex-wrap justify-between gap-2">
            <div>
              <h2
                id="reservation-detail-title"
                className="text-sm font-semibold"
              >
                {selected.patientName} · {labels[selected.status]}
              </h2>
              <p className="text-[10px] text-muted font-mono break-all mt-1">
                {selected.id}
              </p>
            </div>
            <button
              className={button}
              aria-label={text(
                'Close reservation details',
                'إغلاق تفاصيل الحجز',
              )}
              onClick={() => setSelectedId('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="p-3 space-y-3 text-xs">
            <ol
              aria-label={text('Reservation stages', 'مراحل الحجز')}
              className="flex flex-wrap gap-2"
            >
              {stages.map((status, index) => (
                <li
                  key={status}
                  aria-current={selected.status === status ? 'step' : undefined}
                  className={`border rounded-[4px] px-2 py-1 ${selected.status === status ? 'border-brand bg-brand-subtle text-brand font-semibold' : 'border-stroke text-muted'}`}
                >
                  <span className="font-mono">{index + 1}.</span>{' '}
                  {labels[status]}
                </li>
              ))}
            </ol>
            <p>
              <strong>{text('Pickup:', 'الاستلام:')}</strong>{' '}
              <time className="font-mono" dateTime={selected.pickupDate}>
                {selected.pickupDate}
              </time>{' '}
              · {sourceLabel(selected.source)}
            </p>
            <ul className="list-disc ps-4 space-y-1">
              {selected.medications.map((m) => (
                <li key={m.medicationId}>
                  {m.name} · <span className="font-mono">{m.daysSupply}</span>{' '}
                  {text('days requested', 'يوم مطلوب')}
                </li>
              ))}
            </ul>
            {selected.notes && (
              <p className="whitespace-pre-wrap break-words text-muted">
                {selected.notes}
              </p>
            )}
            {!patientAvailable && isOpenReservation(selected) && (
              <p role="alert" className="text-critical-fg">
                {text(
                  'Patient is missing or archived. Restore the record before preparing or collecting, or cancel this request.',
                  'ملف المريض غير موجود أو مؤرشف. استعده قبل التجهيز والاستلام، أو ألغِ الطلب.',
                )}
              </p>
            )}
            {recordChanged && isOpenReservation(selected) && (
              <p role="alert" className="text-critical-fg">
                {text(
                  'Refill details changed since this request. Review the patient record, then cancel and recreate the reservation.',
                  'تغيّرت تفاصيل الصرف منذ الطلب. راجع ملف المريض ثم ألغِ الحجز وأنشئ حجزاً جديداً.',
                )}
              </p>
            )}
            {patientAvailable && (
              <button
                className={`${button} text-brand`}
                onClick={() => onOpenPatient(selected.patientId)}
              >
                {text('Open patient record', 'فتح ملف المريض')}
              </button>
            )}
            {isOpenReservation(selected) && (
              <div className="border-t border-stroke pt-3 space-y-3">
                {selected.status === 'requested' && (
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={stockConfirmed}
                      onChange={(e) => setStockConfirmed(e.target.checked)}
                    />
                    {text(
                      'I checked availability for every medicine in this request.',
                      'تحققت من توفر جميع الأدوية في هذا الطلب.',
                    )}
                  </label>
                )}
                {selected.status !== 'ready' && (
                  <button
                    className={`${button} bg-brand text-on-brand`}
                    disabled={
                      storageError ||
                      !patientAvailable ||
                      recordChanged ||
                      (selected.status === 'requested' && !stockConfirmed)
                    }
                    onClick={() => {
                      if (onAdvance(selected.id, nextStage))
                        setStockConfirmed(false);
                    }}
                  >
                    <Check className="size-3.5" />
                    {selected.status === 'requested'
                      ? text('Confirm stock checked', 'تأكيد فحص المخزون')
                      : text('Mark ready for pickup', 'تحديد كجاهز للاستلام')}
                  </button>
                )}
                {selected.status === 'ready' && (
                  <>
                    <div className="p-2 rounded-[4px] border border-warning-border bg-warning-bg text-warning-fg">
                      <strong>{text('Allergies:', 'الحساسيات:')}</strong>{' '}
                      {currentPatient?.allergies?.trim() ||
                        text(
                          'Not recorded — verify before dispensing.',
                          'غير مسجلة — تحقق قبل الصرف.',
                        )}
                    </div>
                    <button
                      className={button}
                      disabled={
                        storageError ||
                        !patientAvailable ||
                        !isValidPatientPhone(
                          currentPatient?.phone || selected.phone,
                        )
                      }
                      onClick={readyMessage}
                    >
                      <MessageSquare className="size-3.5" />
                      {text(
                        'Prepare ready notification',
                        'تجهيز إشعار الجاهزية',
                      )}
                    </button>
                    <fieldset className="border border-stroke p-3 rounded-[4px] space-y-2">
                      <legend className="px-1 font-semibold">
                        {text(
                          'Confirm collection and dispensing',
                          'تأكيد الاستلام والصرف',
                        )}
                      </legend>
                      {selected.medications.map((m) => (
                        <label
                          key={m.medicationId}
                          className="flex flex-wrap items-center gap-2"
                        >
                          {m.name}
                          <input
                            type="number"
                            min={1}
                            max={365}
                            step={1}
                            aria-label={`${text('Supply in days', 'مدة الصرف بالأيام')}: ${m.name}`}
                            className={`${input} max-w-24 font-mono`}
                            value={supplies[m.medicationId] ?? m.daysSupply}
                            onChange={(e) =>
                              setSupplies((previous) => ({
                                ...Object.fromEntries(
                                  selected.medications.map((med) => [
                                    med.medicationId,
                                    med.daysSupply,
                                  ]),
                                ),
                                ...previous,
                                [m.medicationId]: Number(e.target.value),
                              }))
                            }
                          />
                          {text('days supplied', 'يوم مصروف')}
                        </label>
                      ))}
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={collectConfirmed}
                          onChange={(e) =>
                            setCollectConfirmed(e.target.checked)
                          }
                        />
                        {text(
                          'Patient collected these medicines; the pharmacist verified the regimen and supply.',
                          'استلم المريض الأدوية وتحقق الصيدلي من الخطة ومدة الصرف.',
                        )}
                      </label>
                      <p className="text-muted text-[11px]">
                        {text(
                          'This records today’s dispensing and updates refill dates. A changed medication record must be reviewed before collection.',
                          'يُسجّل صرف اليوم ويحدّث مواعيد التكرار. يجب مراجعة أي تغيير في ملف الدواء قبل الاستلام.',
                        )}
                      </p>
                      <button
                        className={`${button} bg-brand text-on-brand`}
                        disabled={
                          storageError ||
                          !patientAvailable ||
                          recordChanged ||
                          !collectConfirmed ||
                          selected.medications.some((m) => {
                            const n = supplies[m.medicationId] ?? m.daysSupply;
                            return !Number.isInteger(n) || n < 1 || n > 365;
                          })
                        }
                        onClick={() => {
                          const values = Object.fromEntries(
                            selected.medications.map((m) => [
                              m.medicationId,
                              supplies[m.medicationId] ?? m.daysSupply,
                            ]),
                          );
                          if (onCollect(selected.id, values))
                            setCollectConfirmed(false);
                        }}
                      >
                        {text(
                          'Record collection & dispense',
                          'تسجيل الاستلام والصرف',
                        )}
                      </button>
                    </fieldset>
                  </>
                )}
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="space-y-1">
                    <span className="block font-semibold">
                      {text('Change pickup date', 'تغيير تاريخ الاستلام')}
                    </span>
                    <input
                      type="date"
                      aria-label={text(
                        'New pickup date',
                        'تاريخ الاستلام الجديد',
                      )}
                      className={input}
                      min={localDateKey()}
                      value={newDate || selected.pickupDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </label>
                  <button
                    className={button}
                    disabled={
                      storageError ||
                      !newDate ||
                      newDate === selected.pickupDate
                    }
                    onClick={() => onReschedule(selected.id, newDate)}
                  >
                    <CalendarDays className="size-3.5" />
                    {text('Save pickup date', 'حفظ موعد الاستلام')}
                  </button>
                  <button
                    className={`${button} text-critical-fg`}
                    disabled={storageError}
                    onClick={() => setShowCancel(!showCancel)}
                  >
                    {text('Cancel reservation', 'إلغاء الحجز')}
                  </button>
                </div>
                {showCancel && (
                  <div className="flex flex-wrap gap-2">
                    <label className="flex-1 min-w-40 space-y-1">
                      <span>
                        {text('Cancellation reason', 'سبب الإلغاء')} *
                      </span>
                      <input
                        className={input}
                        maxLength={500}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                      />
                    </label>
                    <button
                      className={`${button} text-critical-fg self-end`}
                      disabled={!cancelReason.trim() || storageError}
                      onClick={() => {
                        if (onAdvance(selected.id, 'cancelled', cancelReason))
                          setShowCancel(false);
                      }}
                    >
                      {text('Confirm cancellation', 'تأكيد الإلغاء')}
                    </button>
                  </div>
                )}
              </div>
            )}
            <details className="border-t border-stroke pt-2">
              <summary className="font-semibold">
                {text('Status history', 'سجل الحالات')}{' '}
                <span className="font-mono">({selected.history.length})</span>
              </summary>
              <ol className="mt-2 space-y-1">
                {selected.history.map((event, index) => (
                  <li key={index} className="flex flex-wrap gap-2">
                    <time className="font-mono text-muted" dateTime={event.at}>
                      {new Date(event.at).toLocaleString(
                        lang === 'ar' ? 'ar-IQ' : 'en-GB',
                      )}
                    </time>
                    <span>{labels[event.status]}</span>
                    {event.note && (
                      <span className="text-muted break-all">{event.note}</span>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </section>
      )}

      <section
        className="bg-surface border border-stroke rounded-[4px] overflow-hidden"
        aria-label={text('Reservations list', 'قائمة الحجوزات')}
      >
        <div
          className="flex overflow-x-auto border-b border-stroke px-3"
          role="group"
          aria-label={text('Reservation status filter', 'تصفية حالة الحجز')}
        >
          {(['open', ...stages, 'cancelled', 'all'] as const).map((status) => (
            <button
              key={status}
              aria-pressed={filter === status}
              className={`px-3 py-2.5 text-xs border-b-[3px] whitespace-nowrap font-semibold ${filter === status ? 'border-brand text-brand' : 'border-transparent text-muted hover:bg-hover'}`}
              onClick={() => setFilter(status)}
            >
              {status === 'open'
                ? text('Open', 'مفتوح')
                : status === 'all'
                  ? text('All', 'الكل')
                  : labels[status]}{' '}
              <span className="font-mono">
                {searched.filter((r) => matches(r, status)).length}
              </span>
            </button>
          ))}
        </div>
        <div className="p-3 border-b border-stroke flex gap-2 items-center">
          <Search className="size-3.5 text-muted" />
          <input
            type="search"
            aria-label={text('Search reservations', 'البحث في الحجوزات')}
            className={input}
            placeholder={text(
              'Patient, phone, medicine or reservation ID',
              'المريض أو الهاتف أو الدواء أو رمز الحجز',
            )}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span
            role="status"
            className="text-xs text-muted whitespace-nowrap font-mono"
          >
            {visible.length}
          </span>
        </div>
        {!visible.length ? (
          <div className="p-8 text-center text-xs text-muted">
            {text(
              'No reservations match this view.',
              'لا توجد حجوزات مطابقة لهذا العرض.',
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-xs">
              <thead className="bg-subtle border-b border-stroke">
                <tr>
                  {[
                    text('Patient', 'المريض'),
                    text('Medicines', 'الأدوية'),
                    text('Pickup', 'الاستلام'),
                    text('Status', 'الحالة'),
                    text('Actions', 'الإجراءات'),
                  ].map((label) => (
                    <th scope="col" className="px-3 py-2" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke">
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3">
                      <div className="font-semibold">
                        {patients.find((p) => p.id === r.patientId)?.name ||
                          r.patientName}
                      </div>
                      <div className="font-mono text-muted mt-1" dir="ltr">
                        {r.phone}
                      </div>
                    </td>
                    <td className="p-3">
                      {r.medications.map((m) => m.name).join(', ')}
                    </td>
                    <td className="p-3">
                      <time
                        className="font-mono whitespace-nowrap"
                        dateTime={r.pickupDate}
                      >
                        {r.pickupDate}
                      </time>
                      {isOpenReservation(r) &&
                        r.pickupDate < localDateKey() && (
                          <div className="text-critical-fg mt-1">
                            {text('Pickup overdue', 'موعد الاستلام متأخر')}
                          </div>
                        )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`border px-1.5 py-0.5 rounded-[4px] font-semibold ${r.status === 'collected' ? 'bg-success-bg text-success-fg border-success-border' : r.status === 'ready' ? 'bg-brand-subtle text-brand border-brand' : r.status === 'cancelled' ? 'bg-subtle text-muted border-stroke' : 'bg-warning-bg text-warning-fg border-warning-border'}`}
                      >
                        {labels[r.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        className={button}
                        aria-label={`${text('Manage reservation', 'إدارة الحجز')}: ${r.patientName}`}
                        onClick={() => open(r)}
                      >
                        {text('Manage', 'إدارة')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
