import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CharacterNameplate } from '../src/world/characters/character-nameplate.js';

function fakeText() {
  return {
    x: 0,
    y: 0,
    depth: 0,
    text: '',
    setOrigin() { return this; },
    setResolution() { return this; },
    setText(value) { this.text = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setDepth(value) { this.depth = value; return this; },
    destroy() { this.destroyed = true; },
  };
}

test('character nameplate follows any local or remote sprite above its head', () => {
  const label = fakeText();
  const scene = { add: { text: () => label } };
  const sprite = { x: 100, y: 200, displayWidth: 64, displayHeight: 88, originX: 0, originY: 0, depth: 200 };
  const nameplate = new CharacterNameplate({ scene, sprite, name: 'Robin Ranger' });

  assert.equal(label.text, 'Robin Ranger');
  assert.equal(label.x, 132);
  assert.equal(label.y, 192);
  assert.equal(label.depth, 200.01);

  sprite.x = 164;
  sprite.y = 264;
  sprite.depth = 264;
  nameplate.update();
  assert.equal(label.x, 196);
  assert.equal(label.y, 256);
  assert.equal(label.depth, 264.01);

  nameplate.destroy();
  assert.equal(label.destroyed, true);
});
