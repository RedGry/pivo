import assert from 'node:assert/strict';
import test from 'node:test';
import { actionsVisible } from './controls.ts';

test('visible action controls never precede their native input acknowledgment', () => {
  assert.equal(actionsVisible(0.95, false), false, 'revealing buttons must not appear clickable');
  assert.equal(actionsVisible(1, false), false, 'a painted terminal frame still awaits native input');
  assert.equal(actionsVisible(1, true), true);
});

test('a previous acknowledgment cannot expose actions during reversal or compact mode', () => {
  assert.equal(actionsVisible(0.95, true), false);
  assert.equal(actionsVisible(0, true), false);
});
