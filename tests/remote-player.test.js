import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemotePlayer } from '../src/multiplayer/remote-player.js';

function fakeSprite() {
  return {
    x: 0, y: 0, depth: 0, frame: null, played: null, destroyed: false,
    anims: { stop() {} },
    setOrigin() { return this; }, setDepth(value) { this.depth = value; return this; },
    setFrame(value) { this.frame = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    play(key) { this.played = key; return this; },
    destroy() { this.destroyed = true; },
  };
}

test('remote player interpolates movement and keeps a reusable centered nameplate', () => {
  const sprite = fakeSprite();
  const nameplate = { updates: 0, destroyed: false, update() { this.updates += 1; }, destroy() { this.destroyed = true; } };
  const scene = {
    add: {
      sprite: (x, y) => { sprite.x = x; sprite.y = y; return sprite; },
      tween: (config) => {
        sprite.x = config.x.to;
        sprite.y = config.y.to;
        config.onUpdate();
        config.onComplete();
        return { stop() {} };
      },
    },
    tweens: { killTweensOf() {} },
  };
  const remote = new RemotePlayer({
    scene,
    player: { id: 'friend', name: 'Friend', x: 64, y: 96, direction: 'DOWN', moving: false },
    nameplateFactory: () => nameplate,
  });
  remote.applyState({ id: 'friend', name: 'Friend', x: 96, y: 96, direction: 'RIGHT', moving: true });
  assert.equal(sprite.x, 96);
  assert.equal(sprite.y, 96);
  assert.equal(sprite.played, 'PLAYER_RIGHT');
  assert.ok(nameplate.updates >= 1);
  remote.destroy();
  assert.equal(sprite.destroyed, true);
  assert.equal(nameplate.destroyed, true);
});
