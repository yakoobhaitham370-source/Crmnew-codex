import type { Patient, FollowUpEntry, RefillReservation } from '../types/pharmacy';
import { isOpenReservation } from './reservations';
import { calendarDay, localDateKey } from './patientRecords';

export type QueueRange = 'overdue' | 'today' | 'week' | 'completed';
export type QueueKind = 'all' | 'refill' | 'followup' | 'reservation';
export interface WorkItem {
  id: string;
  kind: 'refill' | 'followup' | 'reservation';
  reservationId?: string;
  patient: Patient;
  medicationIndex?: number;
  followUpId?: string;
  title: string;
  detail?: string;
  dueDate: string;
  daysRemaining: number;
  completed: boolean;
}

export function buildWorkQueue(patients: Patient[], followUps: FollowUpEntry[], today = localDateKey(), reservations: RefillReservation[] = []): WorkItem[] {
  const todayDay = calendarDay(today)!;
  const active = new Map(patients.filter(p => !p.isArchived).map(p => [p.id, p]));
  const items: WorkItem[] = [];
  for (const patient of active.values()) {
    patient.medications.forEach((med, index) => {
      const start = calendarDay(med.lastDispenseDate);
      if (!med.name.trim() || start === null || start > todayDay || !Number.isInteger(med.daysSupply) || med.daysSupply < 1 || med.daysSupply > 365) return;
      const dueDay = start + med.daysSupply;
      const dueDate = new Date(dueDay * 86400000).toISOString().slice(0, 10);
      const reserved = reservations.some(r => r.patientId === patient.id && isOpenReservation(r) && r.medications.some(m => m.medicationId === med.id));
      if (!reserved) items.push({ id: `refill-${patient.id}-${index}`, kind: 'refill', patient, medicationIndex: index, title: med.name, detail: med.dosage, dueDate, daysRemaining: dueDay - todayDay, completed: false });
      // The current dispense date alone can be entered while creating a record.
      // A refill history entry is required to count a completed queue action.
      const collectedInReservation = reservations.some(r => r.patientId === patient.id && r.status === 'collected' && r.collectedAt && localDateKey(new Date(r.collectedAt)) === today && r.medications.some(m => m.medicationId === med.id));
      if (!collectedInReservation && med.refillHistory?.some(record => (typeof record === 'string' ? record : record.date).slice(0, 10) === today)) {
        items.push({ id: `done-${patient.id}-${index}`, kind: 'refill', patient, medicationIndex: index, title: med.name, dueDate: today, daysRemaining: 0, completed: true });
      }
    });
  }
  for (const followUp of followUps) {
    const patient = active.get(followUp.patientId);
    const dueDay = calendarDay(followUp.dueDate);
    if (!patient || dueDay === null) continue;
    if (followUp.resolved && (!followUp.resolvedAt || localDateKey(new Date(followUp.resolvedAt)) !== today)) continue;
    items.push({ id: `followup-${followUp.id}`, kind: 'followup', patient, followUpId: followUp.id, title: followUp.drug, detail: followUp.milestoneTitle || followUp.type, dueDate: followUp.dueDate, daysRemaining: dueDay - todayDay, completed: followUp.resolved });
  }
  for (const reservation of reservations) {
    const patient = active.get(reservation.patientId);
    const pickup = calendarDay(reservation.pickupDate);
    if (!patient || pickup === null || reservation.status === 'cancelled') continue;
    if (reservation.status === 'collected' && (!reservation.collectedAt || localDateKey(new Date(reservation.collectedAt)) !== today)) continue;
    items.push({ id: `reservation-${reservation.id}`, kind: 'reservation', reservationId: reservation.id, patient,
      title: reservation.medications.map(med => med.name).join(', '), detail: reservation.status,
      dueDate: reservation.pickupDate, daysRemaining: pickup - todayDay, completed: reservation.status === 'collected' });
  }
  return items.sort((a, b) => a.daysRemaining - b.daysRemaining || a.patient.name.localeCompare(b.patient.name) || a.id.localeCompare(b.id));
}

export function matchesQueueRange(item: WorkItem, range: QueueRange): boolean {
  if (range === 'completed') return item.completed;
  if (item.completed) return false;
  if (range === 'overdue') return item.daysRemaining < 0;
  if (range === 'today') return item.daysRemaining === 0;
  return item.daysRemaining >= 1 && item.daysRemaining <= 7;
}
