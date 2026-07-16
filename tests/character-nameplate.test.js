import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CharacterNameplate } from '../src/world/characters/character-nameplate.js';

function chainable(extra = {}) {
  return {
    ...extra,
    setOrigin() { return this; },
    setResolution() { return this; },
    setText(value) { this.text = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setDepth(value) { this.depth = value; return this; },
    destroy() { this.destroyed = true; },
  };
}

test('quest-style nameplate stays small and centered above local or remote sprites', () => {
  const label = chainable({ text: '' });
  const panel = chainable({
    rects: [], currentColor: null,
    clear() { this.rects = []; return this; },
    fillStyle(color) { this.currentColor = color; return this; },
    fillRect(x, y, width, height) { this.rects.push({ x, y, width, height, color: this.currentColor }); return this; },
    lineStyle() { return this; },
    strokeRect() { return this; },
  });
  let textStyle;
  const scene = {
    add: {
      text: (_x, _y, _name, style) => { textStyle = style; return label; },
      graphics: () => panel,
    },
  };
  const sprite = { x: 100, y: 200, displayWidth: 64, displayHeight: 88, originX: 0, originY: 0, depth: 200 };
  const nameplate = new CharacterNameplate({ scene, sprite, name: 'AWEADA' });

  assert.equal(textStyle.fontSize, '6px');
  assert.equal(textStyle.fontFamily, 'monospace');
  assert.equal(textStyle.strokeThickness, 1);
  assert.deepEqual(panel.rects[0], { x: 0, y: 0, width: 46, height: 11, color: 0x101a15 });
  assert.equal(panel.rects[1].color, 0xb7ff24);
  assert.equal(panel.x, 77);
  assert.equal(panel.y, 187.5);
  assert.equal(label.x, 100);
  assert.equal(label.y, 193);

  sprite.x = 164;
  sprite.y = 264;
  sprite.depth = 264;
  nameplate.update();
  assert.equal(panel.x, 141);
  assert.equal(label.x, 164);
  assert.equal(label.y, 257);
  assert.ok(Math.abs(label.depth - 264.011) < 1e-9);

  nameplate.destroy();
  assert.equal(panel.destroyed, true);
  assert.equal(label.destroyed, true);
});
