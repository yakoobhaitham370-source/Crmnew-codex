import type { Patient } from '../types/pharmacy';
import { formatPhoneForWhatsApp } from './pharmacyCalculations';

export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)));
}

export function patientPhoneKey(phone: string): string {
  return formatPhoneForWhatsApp(normalizeDigits(phone));
}

export function isValidPatientPhone(phone: string): boolean {
  const input = normalizeDigits(phone).trim();
  return /^\+?[\d\s().-]+$/.test(input) && /^[1-9]\d{7,14}$/.test(patientPhoneKey(input));
}

// UTC day ordinals avoid DST and date-only string timezone shifts.
export function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(0, 0, 0, 0);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed.getTime() / 86400000;
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function duplicatePhonePatients(patient: Patient, patients: Patient[]): Patient[] {
  const key = patientPhoneKey(patient.phone);
  return key ? patients.filter(other => other.id !== patient.id && patientPhoneKey(other.phone) === key) : [];
}

export interface RecordIssue { field: string; en: string; ar: string; tab: 'demographics' | 'regimen' }

export function validatePatientRecord(patient: Patient, today = localDateKey()): RecordIssue[] {
  const issues: RecordIssue[] = [];
  const todayDay = calendarDay(today)!;
  if (!patient.name.trim()) issues.push({ field: 'name', tab: 'demographics', en: 'Enter the patient’s full name.', ar: 'أدخل اسم المريض الكامل.' });
  if (!isValidPatientPhone(patient.phone)) issues.push({ field: 'phone', tab: 'demographics', en: 'Enter a valid phone number (8–15 digits). Iraqi local and international formats are accepted.', ar: 'أدخل رقم هاتف صحيحاً (٨–١٥ رقماً). يمكن استخدام الصيغة العراقية المحلية أو الدولية.' });
  if (patient.dob && (calendarDay(patient.dob) === null || calendarDay(patient.dob)! > todayDay)) issues.push({ field: 'dob', tab: 'demographics', en: 'Enter a valid birth date that is not in the future.', ar: 'أدخل تاريخ ميلاد صحيحاً لا يقع في المستقبل.' });
  patient.medications.forEach((med, index) => {
    if (!med.name.trim()) {
      if (med.dosage?.trim() || med.prescriber?.trim() || med.refillHistory?.length) issues.push({ field: `med-${index}-name`, tab: 'regimen', en: `Medication ${index + 1}: enter a name or remove this row.`, ar: `الدواء ${index + 1}: أدخل الاسم أو احذف السطر.` });
      return;
    }
    if (!Number.isInteger(med.daysSupply) || med.daysSupply < 1 || med.daysSupply > 365) issues.push({ field: `med-${index}-supply`, tab: 'regimen', en: `${med.name}: supply must be a whole number from 1 to 365 days.`, ar: `${med.name}: يجب أن تكون مدة الصرف عدداً صحيحاً من ١ إلى ٣٦٥ يوماً.` });
    const day = calendarDay(med.lastDispenseDate);
    if (day === null || day > todayDay) issues.push({ field: `med-${index}-date`, tab: 'regimen', en: `${med.name}: enter a valid dispense date that is not in the future.`, ar: `${med.name}: أدخل تاريخ صرف صحيحاً لا يقع في المستقبل.` });
  });
  return issues;
}
