import { CHARACTER_ASSET_KEYS } from '../assets/asset-keys.js';
import { CharacterNameplate } from '../world/characters/character-nameplate.js?v=nameplate-v2';

const IDLE_FRAMES = Object.freeze({ DOWN: 7, UP: 1, LEFT: 10, RIGHT: 4, NONE: 7 });

export class RemotePlayer {
  #scene;
  #sprite;
  #nameplate;

  constructor({ scene, player, nameplateFactory = (config) => new CharacterNameplate(config) }) {
    this.#scene = scene;
    this.#sprite = scene.add
      .sprite(player.x, player.y, CHARACTER_ASSET_KEYS.PLAYER, IDLE_FRAMES[player.direction] ?? IDLE_FRAMES.DOWN)
      .setOrigin(0, 0.2)
      .setDepth(player.y);
    this.#nameplate = nameplateFactory({ scene, sprite: this.#sprite, name: player.name });
    this.#nameplate.update();
  }

  applyState(player) {
    this.#scene.tweens.killTweensOf(this.#sprite);
    if (!player.moving) {
      this.#sprite.anims.stop();
      this.#sprite
        .setPosition(player.x, player.y)
        .setFrame(IDLE_FRAMES[player.direction] ?? IDLE_FRAMES.DOWN)
        .setDepth(player.y);
      this.#nameplate.update();
      return;
    }

    this.#sprite.play(`PLAYER_${player.direction}`);
    this.#scene.add.tween({
      delay: 0,
      duration: 550,
      x: { from: this.#sprite.x, start: this.#sprite.x, to: player.x },
      y: { from: this.#sprite.y, start: this.#sprite.y, to: player.y },
      targets: this.#sprite,
      onUpdate: () => {
        this.#sprite.setDepth(this.#sprite.y);
        this.#nameplate.update();
      },
      onComplete: () => {
        this.#sprite.anims.stop();
        this.#sprite.setFrame(IDLE_FRAMES[player.direction] ?? IDLE_FRAMES.DOWN);
        this.#nameplate.update();
      },
    });
  }

  update() {
    this.#nameplate.update();
  }

  destroy() {
    this.#scene.tweens.killTweensOf(this.#sprite);
    this.#nameplate.destroy();
    this.#sprite.destroy();
  }
}
