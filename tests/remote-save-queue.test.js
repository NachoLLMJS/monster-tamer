import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queueRemoteSave } from '../src/utils/remote-save-queue.js';

test('a version conflict refreshes the session version so the next queued save can succeed', async () => {
  const calls = [];
  const session = { token: 'token', character: { id: 'hero', progressVersion: 0 } };
  const save = async (_session, progress, version) => {
    calls.push({ progress, version });
    if (calls.length === 1) {
      const error = Object.assign(new Error('version_conflict'), {
        status: 409,
        body: { current: { id: 'hero', progressVersion: 2, progress: { map: 'plaza' } } },
      });
      throw error;
    }
    return { id: 'hero', progressVersion: 3, progress };
  };

  const first = queueRemoteSave(Promise.resolve(), session, { map: 'forest' }, save);
  await assert.rejects(first, /version_conflict/);
  assert.equal(session.character.progressVersion, 2);

  const second = queueRemoteSave(first, session, { map: 'inn' }, save);
  await second;
  assert.deepEqual(calls.map(({ version }) => version), [0, 2]);
  assert.equal(session.character.progressVersion, 3);
});
