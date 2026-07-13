import Phaser from './lib/phaser.js';
import { SCENE_KEYS } from './scenes/scene-keys.js';
import { PreloadScene } from './scenes/preload-scene.js?v=story-idle-rockbreaker-v3';
import { BattleScene } from './scenes/battle-scene.js?v=enemy-right-v2';
import { WorldScene } from './scenes/world-scene.js?v=story-idle-rockbreaker-v3';
import { TitleScene } from './scenes/title-scene.js';
import { OptionsScene } from './scenes/options-scene.js';
import { TestScene } from './scenes/test-scene.js';
import { MonsterPartyScene } from './scenes/monster-party-scene.js';
import { MonsterDetailsScene } from './scenes/monster-details-scene.js';
import { InventoryScene } from './scenes/inventory-scene.js';
import { CutsceneScene } from './scenes/cutscene-scene.js';
import { DialogScene } from './scenes/dialog-scene.js';

const BASE_GAME_HEIGHT = 576;
const getGameWidthForViewport = () => Math.max(1024, Math.round(BASE_GAME_HEIGHT * (window.innerWidth / window.innerHeight)));

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  pixelArt: false,
  scale: {
    parent: 'game-container',
    width: getGameWidthForViewport(),
    height: BASE_GAME_HEIGHT,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#000000',
});

game.scene.add(SCENE_KEYS.PRELOAD_SCENE, PreloadScene);
game.scene.add(SCENE_KEYS.WORLD_SCENE, WorldScene);
game.scene.add(SCENE_KEYS.BATTLE_SCENE, BattleScene);
game.scene.add(SCENE_KEYS.TITLE_SCENE, TitleScene);
game.scene.add(SCENE_KEYS.OPTIONS_SCENE, OptionsScene);
game.scene.add(SCENE_KEYS.TEST_SCENE, TestScene);
game.scene.add(SCENE_KEYS.MONSTER_PARTY_SCENE, MonsterPartyScene);
game.scene.add(SCENE_KEYS.MONSTER_DETAILS_SCENE, MonsterDetailsScene);
game.scene.add(SCENE_KEYS.INVENTORY_SCENE, InventoryScene);
game.scene.add(SCENE_KEYS.CUTSCENE_SCENE, CutsceneScene);
game.scene.add(SCENE_KEYS.DIALOG_SCENE, DialogScene);
game.scene.start(SCENE_KEYS.PRELOAD_SCENE);
