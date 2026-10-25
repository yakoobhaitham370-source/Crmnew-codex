import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkQueue, matchesQueueRange } from '../src/utils/workQueue';
import { calendarDay, duplicatePhonePatients, isValidPatientPhone, validatePatientRecord } from '../src/utils/patientRecords';
import type { Patient, FollowUpEntry } from '../src/types/pharmacy';

const patient: Patient = { id: 'p1', name: 'Test Patient', phone: '07701234567', loyaltyPoints: 0, createdAt: '2026-10-01', medications: [{ name: 'Test medication', lastDispenseDate: '2026-09-25', daysSupply: 30 }] };
const followUp: FollowUpEntry = { id: 'f1', patientId: 'p1', patientName: 'Test Patient', phone: patient.phone, drug: 'Test treatment', type: 'CHRONIC_INIT', startDate: '2026-10-20', dueDate: '2026-10-25', daysOffset: 5, notes: '', resolved: false, createdAt: '2026-10-20' };
const today = '2026-10-25';

test('today combines refills and unresolved follow-ups using calendar days', () => {
 const items = buildWorkQueue([patient], [followUp], today);
 assert.equal(items.filter(i => matchesQueueRange(i, 'today')).length, 2);
 assert(items.every(i => i.daysRemaining === 0));
});
test('overdue is oldest first and future days 1–7 stay separate from today', () => {
 const p = { ...patient, medications: [0, -5, 1, 7, 8].map(offset => ({name: String(offset), lastDispenseDate: '2026-10-01', daysSupply: 24 + offset})) };
 const items = buildWorkQueue([p], [], today);
 assert.deepEqual(items.filter(i => matchesQueueRange(i, 'overdue')).map(i => i.title), ['-5']);
 assert.deepEqual(items.filter(i => matchesQueueRange(i, 'week')).map(i => i.title), ['1', '7']);
});
test('archived patients and orphaned follow-ups do not enter the queue', () => {
 assert.equal(buildWorkQueue([{ ...patient, isArchived: true }], [followUp], today).length, 0);
 assert.equal(buildWorkQueue([], [followUp], today).length, 0);
});
test('completion requires a refill history event, not just an entered dispense date', () => {
 const p = { ...patient, medications: [{...patient.medications[0], lastDispenseDate: today}] };
 assert.equal(buildWorkQueue([p], [], today).filter(i => matchesQueueRange(i, 'completed')).length, 0);
 p.medications[0] = {...p.medications[0], refillHistory: [{date: today, daysSupply: 30}]};
 assert.equal(buildWorkQueue([p], [], today).filter(i => matchesQueueRange(i, 'completed')).length, 1);
 assert.equal(buildWorkQueue([p], [], '2026-10-26').filter(i => matchesQueueRange(i, 'completed')).length, 0);
});
test('resolved follow-ups count only on the local completion date', () => {
 const f = {...followUp, resolved: true, resolvedAt: '2026-10-25T12:00:00Z'};
 assert.equal(buildWorkQueue([patient], [f], today).filter(i => matchesQueueRange(i, 'completed')).length, 1);
 assert.equal(buildWorkQueue([patient], [f], '2026-10-26').some(i => i.kind === 'followup'), false);
});
test('invalid schedules are excluded instead of silently using a default supply', () => {
 const p = {...patient, medications: [ {...patient.medications[0], lastDispenseDate: '2026-02-30'}, {...patient.medications[0], daysSupply: 0}, {...patient.medications[0], daysSupply: 1.5}, {...patient.medications[0], lastDispenseDate: '2026-10-26'} ]};
 assert.equal(buildWorkQueue([p], [], today).length, 0);
});
test('strict calendar validation handles leap years and rejects impossible dates', () => {
 assert.notEqual(calendarDay('2024-02-29'), null);
 for (const date of ['2026-02-29','2026-13-01','2026-04-31','bad','2026-01-00']) assert.equal(calendarDay(date), null);
});
test('Iraqi local, international and Arabic digits match one identity', () => {
 for (const phone of ['+964 770 123 4567','009647701234567','٠٧٧٠١٢٣٤٥٦٧','۰۷۷۰۱۲۳۴۵۶۷']) {
   assert(isValidPatientPhone(phone));
   assert.equal(duplicatePhonePatients({...patient,id:'new',phone},[patient]).length,1);
 }
 assert.equal(duplicatePhonePatients(patient,[patient]).length,0);
 assert.equal(duplicatePhonePatients({...patient,id:'new'},[{...patient,isArchived:true}]).length,1);
});
test('phone validation rejects missing, malformed, short and overlong numbers', () => {
 for (const phone of ['', '123', '07701234567abc', '1234567890123456', '++9647701234567']) assert.equal(isValidPatientPhone(phone),false);
});
test('record validation covers future birth/dispense dates and invalid supplies', () => {
 assert.equal(validatePatientRecord(patient,today).length,0);
 const p = {...patient,name:' ',phone:'bad',dob:'2027-01-01',medications:[{...patient.medications[0],daysSupply:0,lastDispenseDate:'2026-10-26'}]};
 assert.deepEqual(validatePatientRecord(p,today).map(issue=>issue.field),['name','phone','dob','med-0-supply','med-0-date']);
});
test('empty default medication row is optional but partial clinical information is not dropped', () => {
 assert.equal(validatePatientRecord({...patient,medications:[{name:'',daysSupply:30,lastDispenseDate:today}]},today).length,0);
 assert.equal(validatePatientRecord({...patient,medications:[{name:'',dosage:'twice daily',daysSupply:30,lastDispenseDate:today}]},today)[0].field,'med-0-name');
});
