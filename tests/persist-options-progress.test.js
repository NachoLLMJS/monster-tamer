import assert from 'node:assert/strict';
import { test } from 'node:test';
import { persistOptionsProgress } from '../src/utils/persist-options-progress.js';

test('spectator option changes do not attempt authenticated progress saves', async () => {
  let saves = 0;
  const saved = await persistOptionsProgress(null, async () => { saves += 1; });
  assert.equal(saved, false);
  assert.equal(saves, 0);
});

test('option save rejection is handled instead of becoming an unhandled promise', async () => {
  const errors = [];
  const saved = await persistOptionsProgress(
    { character: { id: 'hero' } },
    async () => { throw new Error('network_down'); },
    (error) => errors.push(error.message),
  );
  assert.equal(saved, false);
  assert.deepEqual(errors, ['network_down']);
});
