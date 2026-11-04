import assert from 'node:assert/strict';
import test from 'node:test';
import { seekConfirmed } from './seek.ts';

test('seek confirmation rejects samples started before acknowledgment and gives lagging players time', () => {
  assert.equal(seekConfirmed(5000, 5000, 1000, null, 200), false);
  assert.equal(seekConfirmed(5000, 1000, 1000, 100, 200), false);
  assert.equal(seekConfirmed(5000, 5600, 1000, 100, 700), true);
  assert.equal(seekConfirmed(5000, 1000, 1000, 100, 2100), true);
  assert.equal(seekConfirmed(10500, 10000, 10000, 100, 200), false);
  assert.equal(seekConfirmed(10500, 10600, 10000, 100, 300), true);
});
