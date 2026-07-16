import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROBINHOOD_CHAIN_MAINNET, normalizePlayerName } from '../src/profile/profile-utils.js';

test('Robinhood Chain Mainnet uses the official network configuration', () => {
  assert.equal(ROBINHOOD_CHAIN_MAINNET.chainId, '0x1237');
  assert.equal(ROBINHOOD_CHAIN_MAINNET.chainName, 'Robinhood Chain');
  assert.deepEqual(ROBINHOOD_CHAIN_MAINNET.nativeCurrency, { name: 'Ether', symbol: 'ETH', decimals: 18 });
  assert.deepEqual(ROBINHOOD_CHAIN_MAINNET.rpcUrls, ['https://rpc.mainnet.chain.robinhood.com']);
  assert.deepEqual(ROBINHOOD_CHAIN_MAINNET.blockExplorerUrls, ['https://robinhoodchain.blockscout.com']);
});

test('player names are trimmed and restricted to safe display characters', () => {
  assert.equal(normalizePlayerName('  Robin Ranger  '), 'Robin Ranger');
  assert.throws(() => normalizePlayerName('x'), /between 3 and 20/);
  assert.throws(() => normalizePlayerName('<script>'), /letters, numbers/);
});
