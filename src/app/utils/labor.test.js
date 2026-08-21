import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLaborCostBreakdown } from './labor.js';

test('separates hourly shift cost from prorated salaried labour', () => {
  const result = calculateLaborCostBreakdown({
    employees: [
      { id: 'hourly', payType: 'hourly', hourlyRate: 20, active: true },
      { id: 'manager', payType: 'salary', annualSalary: 73000, active: true },
    ],
    shifts: [
      { employeeId: 'hourly', date: '2026-08-17', start: '09:00', end: '17:00', breakMinutes: 30, status: 'scheduled' },
      { employeeId: 'manager', date: '2026-08-17', start: '09:00', end: '17:00', breakMinutes: 0, status: 'scheduled' },
    ],
  }, '2026-08-17', '2026-08-23');

  assert.equal(result.hourly, 150);
  assert.equal(result.salaried, 1400);
  assert.equal(result.total, 1550);
});

test('excludes called-off shifts and inactive salaries', () => {
  const result = calculateLaborCostBreakdown({
    employees: [
      { id: 'hourly', payType: 'hourly', hourlyRate: 25, active: true },
      { id: 'former-manager', payType: 'salary', annualSalary: 90000, active: false },
    ],
    shifts: [{ employeeId: 'hourly', date: '2026-08-18', start: '16:00', end: '00:00', breakMinutes: 30, status: 'called-off' }],
  }, '2026-08-17', '2026-08-23');

  assert.deepEqual(result, { hourly: 0, salaried: 0, total: 0 });
});
