import type {
  Patient,
  RefillReservation,
  ReservationStatus,
} from '../types/pharmacy';
import { calendarDay, localDateKey } from './patientRecords';

export const RESERVATION_STORAGE_KEY = 'crm_refill_reservations';
export const isOpenReservation = (r: RefillReservation) =>
  !['collected', 'cancelled'].includes(r.status);
export class ReservationError extends Error {
  constructor(
    public code:
      | 'patient'
      | 'date'
      | 'medications'
      | 'duplicate'
      | 'transition'
      | 'reason'
      | 'changed'
      | 'supply'
      | 'storage',
  ) {
    super(code);
  }
}
export function validatePickupDate(date: string, today = localDateKey()) {
  const day = calendarDay(date);
  if (day === null || day < calendarDay(today)!)
    throw new ReservationError('date');
}

export function reservationRecordChanged(
  reservation: RefillReservation,
  patient: Patient,
): boolean {
  return (
    reservation.patientId !== patient.id ||
    reservation.medications.some((reserved) => {
      const med = patient.medications.find(
        (m) => m.id === reserved.medicationId,
      );
      return (
        !med ||
        med.name !== reserved.name ||
        med.lastDispenseDate !== reserved.lastDispenseDate ||
        med.daysSupply !== reserved.daysSupply
      );
    })
  );
}

export function createReservation(
  patient: Patient,
  indices: number[],
  pickupDate: string,
  source: RefillReservation['source'],
  notes: string,
  reservations: RefillReservation[],
  now = new Date(),
) {
  if (patient.isArchived) throw new ReservationError('patient');
  validatePickupDate(pickupDate, localDateKey(now));
  if (!['whatsapp', 'phone', 'in_person'].includes(source))
    throw new ReservationError('medications');
  const selected = [...new Set(indices)];
  if (
    !selected.length ||
    selected.some(
      (index) =>
        !Number.isInteger(index) || !patient.medications[index]?.name.trim(),
    )
  )
    throw new ReservationError('medications');
  const updated: Patient = {
    ...patient,
    medications: patient.medications.map((med, index) =>
      selected.includes(index) && !med.id
        ? { ...med, id: crypto.randomUUID() }
        : med,
    ),
  };
  const medications = selected.map((index) => updated.medications[index]);
  if (
    medications.some(
      (med) =>
        updated.medications.filter((other) => other.id === med.id).length !== 1,
    )
  )
    throw new ReservationError('medications');
  if (
    medications.some(
      (med) =>
        !Number.isInteger(med.daysSupply) ||
        med.daysSupply < 1 ||
        med.daysSupply > 365 ||
        calendarDay(med.lastDispenseDate) === null ||
        med.lastDispenseDate > localDateKey(now),
    )
  )
    throw new ReservationError('medications');
  if (
    reservations.some(
      (r) =>
        r.patientId === patient.id &&
        isOpenReservation(r) &&
        r.medications.some((reserved) =>
          medications.some((med) => med.id === reserved.medicationId),
        ),
    )
  )
    throw new ReservationError('duplicate');
  const timestamp = now.toISOString();
  const reservation: RefillReservation = {
    id: 'RS-' + crypto.randomUUID(),
    patientId: patient.id,
    patientName: patient.name,
    phone: patient.phone,
    medications: medications.map((med) => ({
      medicationId: med.id!,
      name: med.name,
      daysSupply: med.daysSupply,
      lastDispenseDate: med.lastDispenseDate,
    })),
    pickupDate,
    source,
    notes: notes.trim(),
    status: 'requested',
    createdAt: timestamp,
    updatedAt: timestamp,
    history: [{ status: 'requested', at: timestamp }],
  };
  return { patient: updated, reservation };
}

export function advanceReservation(
  reservation: RefillReservation,
  status: ReservationStatus,
  note = '',
  now = new Date(),
): RefillReservation {
  const next = { requested: 'stock_checked', stock_checked: 'ready' };
  if (status === 'cancelled') {
    if (!isOpenReservation(reservation))
      throw new ReservationError('transition');
    if (!note.trim()) throw new ReservationError('reason');
  } else if (next[reservation.status as keyof typeof next] !== status)
    throw new ReservationError('transition');
  const at = now.toISOString();
  return {
    ...reservation,
    status,
    updatedAt: at,
    history: [
      ...reservation.history,
      { status, at, ...(note.trim() ? { note: note.trim() } : {}) },
    ],
  };
}

export function rescheduleReservation(
  reservation: RefillReservation,
  pickupDate: string,
  now = new Date(),
): RefillReservation {
  if (!isOpenReservation(reservation)) throw new ReservationError('transition');
  validatePickupDate(pickupDate, localDateKey(now));
  const at = now.toISOString();
  return {
    ...reservation,
    pickupDate,
    updatedAt: at,
    history: [
      ...reservation.history,
      {
        status: reservation.status,
        at,
        note: `Pickup: ${reservation.pickupDate} → ${pickupDate}`,
      },
    ],
  };
}

export function collectReservation(
  reservation: RefillReservation,
  patient: Patient,
  supplies: Record<string, number>,
  now = new Date(),
) {
  if (reservation.status !== 'ready') throw new ReservationError('transition');
  if (patient.id !== reservation.patientId || patient.isArchived)
    throw new ReservationError('patient');
  const today = localDateKey(now);
  for (const reserved of reservation.medications) {
    const med = patient.medications.find((m) => m.id === reserved.medicationId);
    // Do not silently dispense a deleted, renamed, edited or already-refilled regimen.
    if (
      !med ||
      med.name !== reserved.name ||
      med.lastDispenseDate !== reserved.lastDispenseDate ||
      med.daysSupply !== reserved.daysSupply
    )
      throw new ReservationError('changed');
    const supply = supplies[reserved.medicationId];
    if (!Number.isInteger(supply) || supply < 1 || supply > 365)
      throw new ReservationError('supply');
  }
  const reward = Math.max(
    ...reservation.medications.map((med) =>
      supplies[med.medicationId] >= 90
        ? 30
        : supplies[med.medicationId] >= 30
          ? 10
          : 0,
    ),
  );
  const updatedPatient: Patient = {
    ...patient,
    loyaltyPoints: (Number(patient.loyaltyPoints) || 0) + reward,
    medications: patient.medications.map((med) => {
      if (!reservation.medications.some((m) => m.medicationId === med.id))
        return med;
      const history = [...(med.refillHistory || [])];
      if (
        !history.some(
          (record) =>
            (typeof record === 'string' ? record : record.date) ===
            med.lastDispenseDate,
        )
      )
        history.push({
          id: crypto.randomUUID(),
          date: med.lastDispenseDate,
          daysSupply: med.daysSupply,
        });
      const event = {
        id: crypto.randomUUID(),
        date: today,
        daysSupply: supplies[med.id!],
        note: `Collected reservation ${reservation.id}`,
      };
      const index = history.findIndex(
        (record) =>
          (typeof record === 'string' ? record : record.date) === today,
      );
      if (index < 0) history.push(event);
      else history[index] = event;
      return {
        ...med,
        lastDispenseDate: today,
        daysSupply: supplies[med.id!],
        refillHistory: history,
      };
    }),
  };
  const at = now.toISOString();
  const updatedReservation: RefillReservation = {
    ...reservation,
    status: 'collected',
    collectedAt: at,
    updatedAt: at,
    history: [...reservation.history, { status: 'collected', at }],
  };
  return { patient: updatedPatient, reservation: updatedReservation };
}

export function parseReservations(value: unknown): RefillReservation[] {
  if (!Array.isArray(value)) throw new Error('Invalid reservation backup');
  const statuses = [
    'requested',
    'stock_checked',
    'ready',
    'collected',
    'cancelled',
  ];
  const ids = new Set<string>();
  for (const r of value) {
    if (
      !r ||
      typeof r.id !== 'string' ||
      !r.id ||
      ids.has(r.id) ||
      typeof r.patientId !== 'string' ||
      typeof r.patientName !== 'string' ||
      typeof r.phone !== 'string' ||
      typeof r.notes !== 'string' ||
      !statuses.includes(r.status) ||
      calendarDay(r.pickupDate) === null ||
      !['whatsapp', 'phone', 'in_person'].includes(r.source) ||
      !Number.isFinite(Date.parse(r.createdAt)) ||
      !Number.isFinite(Date.parse(r.updatedAt)) ||
      !Array.isArray(r.medications) ||
      !r.medications.length ||
      !Array.isArray(r.history) ||
      !r.history.length
    )
      throw new Error('Invalid reservation backup');
    ids.add(r.id);
    const medIds = new Set();
    for (const med of r.medications) {
      if (
        !med ||
        typeof med.medicationId !== 'string' ||
        !med.medicationId ||
        medIds.has(med.medicationId) ||
        typeof med.name !== 'string' ||
        !med.name.trim() ||
        !Number.isInteger(med.daysSupply) ||
        med.daysSupply < 1 ||
        med.daysSupply > 365 ||
        calendarDay(med.lastDispenseDate) === null
      )
        throw new Error('Invalid reservation backup');
      medIds.add(med.medicationId);
    }
    if (
      r.history.some(
        (h: RefillReservation['history'][number]) =>
          !h ||
          !statuses.includes(h.status) ||
          !Number.isFinite(Date.parse(h.at)) ||
          (h.note !== undefined && typeof h.note !== 'string'),
      )
    )
      throw new Error('Invalid reservation backup');
    if (r.status === 'collected' && !Number.isFinite(Date.parse(r.collectedAt)))
      throw new Error('Invalid reservation backup');
  }
  return value;
}

// Save before updating React state. Roll back a partial local write on failure.
export function persistReservationChange(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  reservations: RefillReservation[],
  patients?: Patient[],
) {
  const entries: [string, string][] = [
    [RESERVATION_STORAGE_KEY, JSON.stringify(reservations)],
  ];
  if (patients)
    entries.push([
      'crm_cache_data',
      JSON.stringify(
        patients.map((p) => ({
          ...p,
          scans: (p.scans || []).map(({ dataUrl, ...scan }) => scan),
        })),
      ),
    ]);
  const previous = entries.map(([key]) => [key, storage.getItem(key)] as const);
  const written: string[] = [];
  try {
    for (const [key, value] of entries) {
      storage.setItem(key, value);
      written.push(key);
    }
  } catch {
    for (const [key, value] of previous)
      if (written.includes(key)) {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      }
    throw new ReservationError('storage');
  }
}
