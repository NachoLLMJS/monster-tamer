import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';

const introAsset = 'assets/images/intro/parallax/rural/ruralparallaxsky.png';

test('production intro assets are present and not excluded from Git deployments', () => {
  const tracked = execFileSync('git', ['ls-files', '--error-unmatch', introAsset], { encoding: 'utf8' }).trim();
  const ignored = spawnSync('git', ['check-ignore', introAsset], { encoding: 'utf8' });
  assert.equal(ignored.status, 1, `${introAsset} is still ignored by .gitignore`);
  assert.equal(tracked, introAsset, 'intro asset must be tracked by Git for deployment');
});
