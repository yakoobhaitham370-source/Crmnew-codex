import type { Patient, FollowUpEntry } from '../types/pharmacy';
import { calendarDay, localDateKey } from './patientRecords';

export type QueueRange = 'overdue' | 'today' | 'week' | 'completed';
export type QueueKind = 'all' | 'refill' | 'followup';
export interface WorkItem {
  id: string;
  kind: 'refill' | 'followup';
  patient: Patient;
  medicationIndex?: number;
  followUpId?: string;
  title: string;
  detail?: string;
  dueDate: string;
  daysRemaining: number;
  completed: boolean;
}

export function buildWorkQueue(patients: Patient[], followUps: FollowUpEntry[], today = localDateKey()): WorkItem[] {
  const todayDay = calendarDay(today)!;
  const active = new Map(patients.filter(p => !p.isArchived).map(p => [p.id, p]));
  const items: WorkItem[] = [];
  for (const patient of active.values()) {
    patient.medications.forEach((med, index) => {
      const start = calendarDay(med.lastDispenseDate);
      if (!med.name.trim() || start === null || start > todayDay || !Number.isInteger(med.daysSupply) || med.daysSupply < 1 || med.daysSupply > 365) return;
      const dueDay = start + med.daysSupply;
      const dueDate = new Date(dueDay * 86400000).toISOString().slice(0, 10);
      items.push({ id: `refill-${patient.id}-${index}`, kind: 'refill', patient, medicationIndex: index, title: med.name, detail: med.dosage, dueDate, daysRemaining: dueDay - todayDay, completed: false });
      // The current dispense date alone can be entered while creating a record.
      // A refill history entry is required to count a completed queue action.
      if (med.refillHistory?.some(record => (typeof record === 'string' ? record : record.date).slice(0, 10) === today)) {
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
  return items.sort((a, b) => a.daysRemaining - b.daysRemaining || a.patient.name.localeCompare(b.patient.name) || a.id.localeCompare(b.id));
}

export function matchesQueueRange(item: WorkItem, range: QueueRange): boolean {
  if (range === 'completed') return item.completed;
  if (item.completed) return false;
  if (range === 'overdue') return item.daysRemaining < 0;
  if (range === 'today') return item.daysRemaining === 0;
  return item.daysRemaining >= 1 && item.daysRemaining <= 7;
}
