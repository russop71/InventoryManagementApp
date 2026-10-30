import test from 'node:test';
import assert from 'node:assert/strict';
import start from './start.js';
import sync from './sync.js';

for (const [name, handler] of [['start', start], ['sync', sync]]) {
  test(`Clover ${name} tells cached clients activation is required without syncing`, () => {
    const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    handler({ method: 'POST', body: { locationId: 'untrusted-location' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'CLOVER_ACTIVATION_REQUIRED');
    assert.match(res.body.error, /CSV or JSON/);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.body.authorizeUrl, undefined);
  });
}
