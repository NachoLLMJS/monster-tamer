export class CharacterNameplate {
  #sprite;
  #panel;
  #label;
  #width = 28;

  constructor({ scene, sprite, name }) {
    this.#sprite = sprite;
    this.#panel = scene.add.graphics();
    this.#label = scene.add.text(0, 0, name, {
      fontFamily: 'monospace',
      fontSize: '6px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#071008',
      strokeThickness: 1,
      align: 'center',
    });
    this.#label.setOrigin(0.5, 0.5).setResolution(3).setText(name);
    this.#syncPanelSize();
    this.update();
  }

  #syncPanelSize() {
    this.#width = Math.max(28, Array.from(this.#label.text).length * 6 + 10);
    this.#panel
      .clear()
      .fillStyle(0x101a15, 0.9)
      .fillRect(0, 0, this.#width, 11)
      .lineStyle(1, 0x58723d, 0.9)
      .strokeRect(0, 0, this.#width, 11)
      .fillStyle(0xb7ff24, 1)
      .fillRect(1, 2, 2, 7);
  }

  setName(name) {
    this.#label.setText(name);
    this.#syncPanelSize();
  }

  update() {
    const top = this.#sprite.y - this.#sprite.originY * this.#sprite.displayHeight;
    const centerY = top - 7;
    const depth = this.#sprite.depth + 0.01;
    this.#panel
      .setPosition(this.#sprite.x - this.#width / 2, centerY - 5.5)
      .setDepth(depth);
    this.#label
      .setPosition(this.#sprite.x, centerY)
      .setDepth(depth + 0.001);
  }

  destroy() {
    this.#panel.destroy();
    this.#label.destroy();
  }
}
