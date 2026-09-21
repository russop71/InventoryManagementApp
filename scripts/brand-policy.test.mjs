import test from 'node:test';
import assert from 'node:assert/strict';
import { brandViolations } from './brand-policy.mjs';
test('rejects old yellow branding on any application page', () => {
  for (const colour of ['#F5D62E', '#f5c10e']) assert.ok(brandViolations('src/app/pages/NewPage.tsx', colour).length);
});
test('rejects primary overrides even when orange also occurs', () => {
  assert.ok(brandViolations('src/styles/theme.css', ':root { --primary: #F58220; } .dark { --primary: yellow; }').length);
  assert.deepEqual(brandViolations('src/styles/theme.css', ':root { --primary: #F58220; }'), []);
});
test('preserves semantic stock yellow and requires approved wordmark', () => {
  assert.deepEqual(brandViolations('src/app/utils/stockLevels.js', "'bg-yellow-500' #FEF9C3"), []);
  assert.ok(brandViolations('src/app/components/ZestIQBrand.tsx', '/zestiq-mark-exact.png').length);
});
