export class CharacterNameplate {
  #sprite;
  #label;

  constructor({ scene, sprite, name }) {
    this.#sprite = sprite;
    this.#label = scene.add.text(0, 0, name, {
      fontFamily: 'Kenney-Future-Narrow, monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#071008',
      strokeThickness: 4,
      backgroundColor: 'rgba(5, 10, 8, 0.72)',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
      align: 'center',
    });
    this.#label.setOrigin(0.5, 1).setResolution(2).setText(name);
    this.update();
  }

  setName(name) {
    this.#label.setText(name);
  }

  update() {
    const left = this.#sprite.x - this.#sprite.originX * this.#sprite.displayWidth;
    const top = this.#sprite.y - this.#sprite.originY * this.#sprite.displayHeight;
    this.#label
      .setPosition(left + this.#sprite.displayWidth / 2, top - 8)
      .setDepth(this.#sprite.depth + 0.01);
  }

  destroy() {
    this.#label.destroy();
  }
}
