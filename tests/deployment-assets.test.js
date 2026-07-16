import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';

const introAsset = 'assets/images/intro/parallax/rural/ruralparallaxsky.png';

test('production intro assets are present and not excluded from Git deployments', () => {
  const files = execFileSync('git', ['status', '--short', '--untracked-files=all', 'assets/images/intro'], { encoding: 'utf8' });
  const ignored = spawnSync('git', ['check-ignore', introAsset], { encoding: 'utf8' });
  assert.equal(ignored.status, 1, `${introAsset} is still ignored by .gitignore`);
  assert.match(files, /assets\/images\/intro/, 'intro assets must be visible to Git for deployment');
});
