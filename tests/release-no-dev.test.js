import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

test('release build contains no local progress persistence or collision encounter dev controls', async () => {
  const [dataManager, worldScene, index] = await Promise.all([
    readFile(new URL('src/utils/data-manager.js', root), 'utf8'),
    readFile(new URL('src/scenes/world-scene.js', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
  ]);
  assert.doesNotMatch(dataManager, /localStorage|LOCAL_STORAGE_KEY|typeof Storage/);
  assert.doesNotMatch(worldScene, /createDevCollisionEditor|DEV_COLLISION|NO POKEMONS|tameriaDevNoPokemons/);
  assert.doesNotMatch(index, /tameriaDevNoPokemons/);
});
