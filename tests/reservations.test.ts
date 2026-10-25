import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Patient } from '../src/types/pharmacy';
import {
  createReservation,
  advanceReservation,
  collectReservation,
  rescheduleReservation,
  isOpenReservation,
  parseReservations,
  persistReservationChange,
  RESERVATION_STORAGE_KEY,
  ReservationError,
} from '../src/utils/reservations';
import { buildWorkQueue, matchesQueueRange } from '../src/utils/workQueue';

const now = new Date(2026, 9, 25, 12);
const patient: Patient = {
  id: 'p-test',
  name: 'Reservation Patient',
  phone: '07701234567',
  createdAt: now.toISOString(),
  loyaltyPoints: 0,
  allergies: 'Penicillin',
  medications: [
    { name: 'Medicine A', daysSupply: 30, lastDispenseDate: '2026-09-25' },
    { name: 'Medicine B', daysSupply: 30, lastDispenseDate: '2026-09-25' },
  ],
};
const request = () =>
  createReservation(
    patient,
    [0],
    '2026-10-25',
    'whatsapp',
    'Please prepare',
    [],
    now,
  );
const ready = () => {
  const result = request();
  return {
    ...result,
    reservation: advanceReservation(
      advanceReservation(result.reservation, 'stock_checked', '', now),
      'ready',
      '',
      now,
    ),
  };
};
const fails = (fn: () => unknown, code: string) =>
  assert.throws(
    fn,
    (error) => error instanceof ReservationError && error.code === code,
  );

test('request captures selected medicines, patient reply source and stable medication identity without dispensing', () => {
  const result = request();
  assert.equal(result.reservation.status, 'requested');
  assert.equal(result.reservation.source, 'whatsapp');
  assert.equal(result.reservation.medications.length, 1);
  assert(result.patient.medications[0].id);
  assert.equal(
    result.patient.medications[0].lastDispenseDate,
    patient.medications[0].lastDispenseDate,
  );
  assert.equal(patient.medications[0].id, undefined);
  assert.equal(result.reservation.history.length, 1);
});
test('request validates dates, archived patients, selections and valid medication schedules', () => {
  fails(
    () => createReservation(patient, [0], '2026-10-24', 'phone', '', [], now),
    'date',
  );
  fails(
    () => createReservation(patient, [0], '2026-02-30', 'phone', '', [], now),
    'date',
  );
  fails(
    () =>
      createReservation(
        { ...patient, isArchived: true },
        [0],
        '2026-10-25',
        'phone',
        '',
        [],
        now,
      ),
    'patient',
  );
  for (const indices of [[], [99], [-1], [0.5]])
    fails(
      () =>
        createReservation(patient, indices, '2026-10-25', 'phone', '', [], now),
      'medications',
    );
  fails(
    () =>
      createReservation(
        {
          ...patient,
          medications: [{ ...patient.medications[0], daysSupply: 0 }],
        },
        [0],
        '2026-10-25',
        'phone',
        '',
        [],
        now,
      ),
    'medications',
  );
});
test('duplicate active reservation is blocked but different medicines remain reservable', () => {
  const result = request();
  fails(
    () =>
      createReservation(
        result.patient,
        [0],
        '2026-10-26',
        'phone',
        '',
        [result.reservation],
        now,
      ),
    'duplicate',
  );
  assert.equal(
    createReservation(
      result.patient,
      [1],
      '2026-10-26',
      'phone',
      '',
      [result.reservation],
      now,
    ).reservation.status,
    'requested',
  );
  const cancelled = advanceReservation(
    result.reservation,
    'cancelled',
    'Patient declined',
    now,
  );
  assert(
    createReservation(
      result.patient,
      [0],
      '2026-10-26',
      'phone',
      '',
      [cancelled],
      now,
    ),
  );
});
test('only ordered stages are allowed, with an append-only timestamped history', () => {
  const result = request();
  fails(
    () => advanceReservation(result.reservation, 'ready', '', now),
    'transition',
  );
  fails(
    () => advanceReservation(result.reservation, 'collected', '', now),
    'transition',
  );
  const checked = advanceReservation(
    result.reservation,
    'stock_checked',
    '',
    now,
  );
  const prepared = advanceReservation(checked, 'ready', '', now);
  assert.deepEqual(
    prepared.history.map((h) => h.status),
    ['requested', 'stock_checked', 'ready'],
  );
  assert.equal(result.reservation.history.length, 1);
  fails(() => advanceReservation(prepared, 'requested', '', now), 'transition');
});
test('cancellation requires a reason and cannot be reopened or collected', () => {
  const result = request();
  fails(
    () => advanceReservation(result.reservation, 'cancelled', ' ', now),
    'reason',
  );
  const cancelled = advanceReservation(
    result.reservation,
    'cancelled',
    'Out of stock',
    now,
  );
  assert.equal(isOpenReservation(cancelled), false);
  assert.equal(cancelled.history.at(-1)?.note, 'Out of stock');
  fails(
    () => collectReservation(cancelled, result.patient, {}, now),
    'transition',
  );
  fails(
    () => advanceReservation(cancelled, 'stock_checked', '', now),
    'transition',
  );
});
test('rescheduling keeps stage and prior pickup date in history; terminal records are immutable', () => {
  const result = ready();
  const moved = rescheduleReservation(result.reservation, '2026-10-27', now);
  assert.equal(moved.status, 'ready');
  assert.equal(moved.pickupDate, '2026-10-27');
  assert.match(moved.history.at(-1)!.note!, /2026-10-25 → 2026-10-27/);
  fails(() => rescheduleReservation(moved, '2026-10-24', now), 'date');
  const collected = collectReservation(
    result.reservation,
    result.patient,
    { [result.patient.medications[0].id!]: 30 },
    now,
  );
  fails(
    () => rescheduleReservation(collected.reservation, '2026-10-27', now),
    'transition',
  );
});
test('collection records actual supply and preserves history without touching other medicines', () => {
  const result = ready();
  const id = result.patient.medications[0].id!;
  const collected = collectReservation(
    result.reservation,
    result.patient,
    { [id]: 60 },
    now,
  );
  assert.equal(collected.reservation.status, 'collected');
  assert.equal(collected.reservation.collectedAt, now.toISOString());
  assert.equal(collected.patient.medications[0].lastDispenseDate, '2026-10-25');
  assert.equal(collected.patient.medications[0].daysSupply, 60);
  assert.equal(collected.patient.medications[0].refillHistory?.length, 2);
  assert.deepEqual(collected.patient.medications[1], patient.medications[1]);
  fails(
    () =>
      collectReservation(
        collected.reservation,
        collected.patient,
        { [id]: 60 },
        now,
      ),
    'transition',
  );
});
test('collection blocks missing, renamed, already refilled, or changed medication records', () => {
  const result = ready();
  const id = result.patient.medications[0].id!;
  for (const modifications of [
    { name: 'Changed medicine' },
    { lastDispenseDate: '2026-10-24' },
    { daysSupply: 60 },
  ]) {
    const changed = {
      ...result.patient,
      medications: [{ ...result.patient.medications[0], ...modifications }],
    };
    fails(
      () => collectReservation(result.reservation, changed, { [id]: 30 }, now),
      'changed',
    );
  }
  fails(
    () =>
      collectReservation(
        result.reservation,
        { ...result.patient, medications: [] },
        { [id]: 30 },
        now,
      ),
    'changed',
  );
  fails(
    () =>
      collectReservation(
        result.reservation,
        { ...result.patient, isArchived: true },
        { [id]: 30 },
        now,
      ),
    'patient',
  );
  for (const supply of [0, 366, 1.5, NaN])
    fails(
      () =>
        collectReservation(
          result.reservation,
          result.patient,
          { [id]: supply },
          now,
        ),
      'supply',
    );
});
test('queue replaces a reserved medication task with its pickup, preserving unrelated tasks', () => {
  const result = request();
  const items = buildWorkQueue([result.patient], [], '2026-10-25', [
    result.reservation,
  ]);
  assert.equal(items.filter((i) => i.kind === 'reservation').length, 1);
  assert.equal(items.filter((i) => i.kind === 'refill').length, 1);
  assert.equal(items.filter((i) => matchesQueueRange(i, 'today')).length, 2);
});
test('completed reservations do not double count underlying dispensing history', () => {
  const result = ready();
  const id = result.patient.medications[0].id!;
  const collected = collectReservation(
    result.reservation,
    result.patient,
    { [id]: 30 },
    now,
  );
  const items = buildWorkQueue([collected.patient], [], '2026-10-25', [
    collected.reservation,
  ]);
  assert.equal(
    items.filter((i) => matchesQueueRange(i, 'completed')).length,
    1,
  );
  assert.equal(items.find((i) => i.completed)?.kind, 'reservation');
  assert.equal(
    buildWorkQueue([collected.patient], [], '2026-10-26', [
      collected.reservation,
    ]).some((i) => i.kind === 'reservation'),
    false,
  );
});
test('backup parsing roundtrips requests and rejects malformed/duplicate records', () => {
  const result = ready();
  assert.deepEqual(
    parseReservations(JSON.parse(JSON.stringify([result.reservation]))),
    [result.reservation],
  );
  for (const malformed of [
    null,
    {},
    [{}],
    [result.reservation, result.reservation],
    [{ ...result.reservation, pickupDate: 'bad' }],
    [{ ...result.reservation, medications: [{}] }],
    [{ ...result.reservation, status: 'collected' }],
  ])
    assert.throws(() => parseReservations(malformed));
});
test('local storage writes roll back reservations when patient storage fails', () => {
  const result = request();
  const values = new Map<string, string>([
    [RESERVATION_STORAGE_KEY, '[]'],
    ['crm_cache_data', 'old patient state'],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === 'crm_cache_data') throw new Error('quota');
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  fails(
    () =>
      persistReservationChange(storage, [result.reservation], [result.patient]),
    'storage',
  );
  assert.equal(values.get(RESERVATION_STORAGE_KEY), '[]');
  assert.equal(values.get('crm_cache_data'), 'old patient state');
});
