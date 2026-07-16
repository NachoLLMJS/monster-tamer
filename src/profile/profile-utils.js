export const ROBINHOOD_CHAIN_MAINNET = Object.freeze({
  chainId: '0x1237',
  chainName: 'Robinhood Chain',
  nativeCurrency: Object.freeze({ name: 'Ether', symbol: 'ETH', decimals: 18 }),
  rpcUrls: Object.freeze(['https://rpc.mainnet.chain.robinhood.com']),
  blockExplorerUrls: Object.freeze(['https://robinhoodchain.blockscout.com']),
});

const PLAYER_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _'-]*[\p{L}\p{N}]$/u;

export function normalizePlayerName(input) {
  const name = String(input ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 20) {
    throw new Error('Name must be between 3 and 20 characters.');
  }
  if (!PLAYER_NAME_PATTERN.test(name)) {
    throw new Error("Use only letters, numbers, spaces, apostrophes, hyphens, or underscores.");
  }
  return name;
}

export function getEthereumProvider() {
  const injected = window.ethereum;
  if (!injected) {
    return null;
  }
  const providers = Array.isArray(injected.providers) ? injected.providers : [];
  return providers.find((provider) => provider.isMetaMask) ?? injected;
}

export async function connectRobinhoodWallet(provider) {
  if (!provider) {
    throw new Error('No EVM wallet detected. Install MetaMask or Robinhood Wallet.');
  }
  const [wallet] = await provider.request({ method: 'eth_requestAccounts' });
  if (!wallet) {
    throw new Error('No wallet account was selected.');
  }
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ROBINHOOD_CHAIN_MAINNET.chainId }],
    });
  } catch (error) {
    if (Number(error?.code) !== 4902) {
      throw error;
    }
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [ROBINHOOD_CHAIN_MAINNET],
    });
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ROBINHOOD_CHAIN_MAINNET.chainId }],
    });
  }
  const chainId = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
  if (chainId !== ROBINHOOD_CHAIN_MAINNET.chainId) {
    throw new Error('Switch your wallet to Robinhood Chain.');
  }
  return String(wallet).toLowerCase();
}
