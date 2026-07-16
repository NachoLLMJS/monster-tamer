import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAutosaveScheduler } from '../src/utils/autosave.js';

test('autosave coalesces rapid progress changes and flushes the latest state', async () => {
  let timerCallback;
  let saves = 0;
  const scheduler = createAutosaveScheduler({
    save: async () => { saves += 1; }, delay: 750,
    setTimer: (callback) => { timerCallback = callback; return 1; }, clearTimer() {},
  });
  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  assert.equal(saves, 0);
  await timerCallback();
  assert.equal(saves, 1);
  scheduler.schedule();
  await scheduler.flush();
  assert.equal(saves, 2);
  scheduler.destroy();
});

test('autosave retains dirty state and retries after a transient failure', async () => {
  const errors = [];
  const timers = [];
  let attempts = 0;
  const scheduler = createAutosaveScheduler({
    save: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
    },
    onError: (error) => errors.push(error.message),
    setTimer: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimer() {}, retryDelay: 1000,
  });
  scheduler.schedule();
  await timers.shift().callback();
  assert.deepEqual(errors, ['offline']);
  assert.equal(timers.length, 1, 'failed saves must remain pending and arm a retry');
  await timers.shift().callback();
  assert.equal(attempts, 2);
  scheduler.destroy();
});

test('a mutation arriving during an in-flight save schedules a follow-up save', async () => {
  const timers = [];
  let release;
  let saves = 0;
  const scheduler = createAutosaveScheduler({
    save: async () => {
      saves += 1;
      if (saves === 1) await new Promise((resolve) => { release = resolve; });
    },
    setTimer: (callback) => { timers.push(callback); return timers.length; }, clearTimer() {},
  });
  scheduler.schedule();
  const firstSave = timers.shift()();
  scheduler.schedule();
  release();
  await firstSave;
  assert.equal(timers.length, 1);
  await timers.shift()();
  assert.equal(saves, 2);
  scheduler.destroy();
});
