import {
  authenticateWallet,
  createPlayerCharacter,
  listPlayerCharacters,
  loadPlayerCharacter,
} from './profile-api.js?v=characters-v1';
import { normalizePlayerName } from './profile-utils.js?v=characters-v1';

function friendlyError(error) {
  const code = error?.message;
  if (code === 'name_taken') return 'That character name is already taken.';
  if (code === 'invalid_or_expired_nonce') return 'The login request expired. Connect your wallet again.';
  if (code === 'authentication_required' || code === 'invalid_session') return 'Your session expired. Connect your wallet again.';
  if (code === 'character_not_found') return 'That character could not be loaded.';
  if (String(code).includes('User rejected') || error?.code === 4001) return 'The wallet request was cancelled.';
  return code || 'Unable to connect. Please try again.';
}

function shortWallet(wallet) {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export function showProfileScreen({ root, onAuthenticated }) {
  root.querySelector('.intro-actions')?.remove();
  const hub = document.createElement('main');
  hub.className = 'profile-hub';
  hub.setAttribute('aria-label', 'Create or select your Tameria character');
  hub.innerHTML = `
    <section class="profile-creator">
      <div class="profile-avatar-panel">
        <div class="profile-avatar-stage" aria-label="Your Tameria character">
          <div class="profile-avatar-shadow"></div>
          <div class="profile-avatar"></div>
        </div>
        <div class="profile-avatar-name" id="profile-avatar-name">YOUR NAME</div>
        <div class="profile-chain-badge">ROBINHOOD CHAIN · MAINNET</div>
      </div>
      <div class="profile-form-panel">
        <span class="profile-eyebrow">ONE WALLET · MULTIPLE CHARACTERS</span>
        <h1>Create your character</h1>
        <p class="profile-copy">Connect your wallet to create a new character or continue an existing adventure stored in Railway.</p>
        <button class="profile-wallet-button" id="profile-connect" type="button">
          <span class="profile-wallet-dot"></span>
          Connect Wallet
        </button>
        <p class="profile-wallet-note">Robinhood Chain Mainnet · Signature only · No gas fee</p>
        <div class="profile-divider"><span>NEW CHARACTER</span></div>
        <label class="profile-label" for="profile-name">Character name</label>
        <input class="profile-input" id="profile-name" type="text" minlength="3" maxlength="20" autocomplete="off" placeholder="Enter your name" disabled />
        <p class="profile-hint">Connect first. Names are unique and progress is saved only in Railway.</p>
        <button class="profile-primary" id="profile-create" type="button" disabled>Create Character</button>
        <div class="profile-status" id="profile-status" role="status" aria-live="polite"></div>
      </div>
    </section>
    <section class="profile-character-library" aria-labelledby="character-library-title">
      <div>
        <span class="profile-eyebrow">YOUR WALLET</span>
        <h2 id="character-library-title">Your characters</h2>
      </div>
      <div class="profile-character-list" id="profile-character-list">
        <p class="profile-library-empty">Connect your wallet to load your characters.</p>
      </div>
    </section>
  `;
  root.appendChild(hub);

  const creator = hub.querySelector('.profile-creator');
  const input = hub.querySelector('#profile-name');
  const createButton = hub.querySelector('#profile-create');
  const walletButton = hub.querySelector('#profile-connect');
  const status = hub.querySelector('#profile-status');
  const avatarName = hub.querySelector('#profile-avatar-name');
  const characterList = hub.querySelector('#profile-character-list');
  let session = null;

  const setStatus = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const enterCharacter = async (characterId) => {
    setStatus('Loading character progress from Railway…');
    const character = await loadPlayerCharacter(session, characterId);
    session.character = character;
    avatarName.textContent = character.name;
    setStatus(`Welcome back, ${character.name}.`, 'success');
    await onAuthenticated(session);
  };

  const renderCharacters = (characters) => {
    characterList.replaceChildren();
    if (characters.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'profile-library-empty';
      empty.textContent = 'No characters yet. Create your first one above.';
      characterList.appendChild(empty);
      return;
    }
    characters.forEach((character) => {
      const card = document.createElement('article');
      card.className = 'profile-character-card';
      const identity = document.createElement('div');
      identity.className = 'profile-character-identity';
      const portrait = document.createElement('div');
      portrait.className = 'profile-character-portrait';
      const details = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = character.name;
      const meta = document.createElement('p');
      meta.textContent = `Progress v${character.progressVersion} · Saved ${new Date(character.updatedAt).toLocaleDateString()}`;
      details.append(name, meta);
      identity.append(portrait, details);
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'profile-character-play';
      play.textContent = 'Play';
      play.addEventListener('click', async () => {
        play.disabled = true;
        try {
          await enterCharacter(character.id);
        } catch (error) {
          console.error('Unable to load character', error);
          setStatus(friendlyError(error), 'error');
          play.disabled = false;
        }
      });
      card.append(identity, play);
      characterList.appendChild(card);
    });
  };

  input.addEventListener('input', () => {
    avatarName.textContent = input.value.trim() || 'YOUR NAME';
  });

  walletButton.addEventListener('click', async () => {
    walletButton.disabled = true;
    walletButton.textContent = 'Connecting…';
    setStatus('Switching to Robinhood Chain Mainnet…');
    try {
      session = await authenticateWallet();
      walletButton.textContent = `Connected · ${shortWallet(session.wallet)}`;
      walletButton.classList.add('is-connected');
      input.disabled = false;
      createButton.disabled = false;
      setStatus('Wallet authenticated. Choose a character or create a new one.', 'success');
      renderCharacters(await listPlayerCharacters(session));
      input.focus();
    } catch (error) {
      console.error('Wallet authentication failed', error);
      setStatus(friendlyError(error), 'error');
      walletButton.disabled = false;
      walletButton.textContent = 'Connect Wallet';
    }
  });

  createButton.addEventListener('click', async () => {
    if (!session) {
      setStatus('Connect your wallet first.', 'error');
      return;
    }
    try {
      const name = normalizePlayerName(input.value);
      input.disabled = true;
      createButton.disabled = true;
      createButton.textContent = 'Creating…';
      setStatus('Creating your character in Railway…');
      const character = await createPlayerCharacter(session, name);
      session.character = character;
      avatarName.textContent = character.name;
      setStatus('Character created. Entering Tameria…', 'success');
      await onAuthenticated(session);
    } catch (error) {
      console.error('Character creation failed', error);
      setStatus(friendlyError(error), 'error');
      input.disabled = false;
      createButton.disabled = false;
      createButton.textContent = 'Create Character';
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !createButton.disabled) createButton.click();
  });

  requestAnimationFrame(() => creator.classList.add('is-visible'));
  return hub;
}
