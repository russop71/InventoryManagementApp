import test from 'node:test';
import assert from 'node:assert/strict';
import { countSheetHtml } from './printCountSheet.js';
const entries = [{ name: 'Milk', storageArea: 'Cooler', unit: 'L', shelfOrder: 2, counted: 785, hypothetical: 999 }, { name: 'Apples', storageArea: 'Cooler', unit: 'ea', shelfOrder: 1 }, { name: '<Flour>', unit: 'kg' }];
test('selected areas, shelf order, blank counts and escaped names', () => {
  const html = countSheetHtml(entries, ['Cooler'], '2026-09-12');
  assert.ok(html.indexOf('Apples') < html.indexOf('Milk'));
  assert.ok(!html.includes('Flour'));
  assert.ok(!html.includes('785') && !html.includes('999'));
  assert.match(html, /<td><\/td><td><\/td>/);
  const all = countSheetHtml(entries, ['Cooler', 'Unassigned'], '2026-09-12');
  assert.match(all, /&lt;Flour&gt;/);
  assert.equal((all.match(/<section>/g) || []).length, 2);
});
test('empty selection and duplicate item locations are respected', () => {
  assert.equal((countSheetHtml(entries, [], '').match(/<section>/g) || []).length, 0);
  const html = countSheetHtml([{name:'Milk',storageArea:'Bar',unit:'L'},...entries], ['Bar','Cooler'], '', ['Cooler','Bar']);
  assert.equal((html.match(/<td>Milk<\/td>/g)||[]).length, 2);
  assert.ok(html.indexOf('<h2>Cooler') < html.indexOf('<h2>Bar'));
});
