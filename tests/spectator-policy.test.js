import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPECTATOR_ACTION, isWorldActionAllowed } from '../src/world/spectator-policy.js';

test('spectators can move and cross map entrances but cannot play or change progress', () => {
  assert.equal(isWorldActionAllowed(true, SPECTATOR_ACTION.MOVE), true);
  assert.equal(isWorldActionAllowed(true, SPECTATOR_ACTION.ENTER_MAP), true);
  for (const action of [
    SPECTATOR_ACTION.INTERACT,
    SPECTATOR_ACTION.MENU,
    SPECTATOR_ACTION.EVENT,
    SPECTATOR_ACTION.ENCOUNTER,
    SPECTATOR_ACTION.PROGRESS,
  ]) {
    assert.equal(isWorldActionAllowed(true, action), false, `${action} must be blocked`);
  }
});

test('authenticated players retain every world action', () => {
  for (const action of Object.values(SPECTATOR_ACTION)) {
    assert.equal(isWorldActionAllowed(false, action), true);
  }
});
