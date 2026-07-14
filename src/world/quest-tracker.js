import Phaser from '../lib/phaser.js';
import { DATA_MANAGER_STORE_KEYS, dataManager } from '../utils/data-manager.js';
import { STORY_FLAGS } from './story-flags.js';

const STORY_QUESTS = Object.freeze([
  {
    id: 'meet-mother',
    number: 1,
    title: 'Habla con tu madre',
    description: 'Te espera frente a la casa con el grafiti de Robinhood.',
    requiresEvents: [],
    completesOnEvent: 1,
  },
  {
    id: 'meet-professor',
    number: 2,
    title: 'Ve a ver al Profesor CZ',
    description: 'Está junto a la casa vecina. Habla con él antes de entrar en la hierba.',
    requiresEvents: [1],
    completesOnEvent: 2,
  },
  {
    id: 'get-rock-breaker',
    number: 3,
    title: 'Consigue el Romperrocas',
    description: 'Busca al comerciante anciano del camino norte de Tameria.',
    requiresEvents: [2],
    completesOnFlag: STORY_FLAGS.HAS_ROCK_BREAKER,
  },
  {
    id: 'talk-ranger',
    number: 4,
    title: 'Habla con el guardabosques',
    description: 'Te explicará cómo atravesar la barrera del Bosque Esmeralda.',
    requiresFlags: [STORY_FLAGS.HAS_ROCK_BREAKER],
    completesOnFlag: STORY_FLAGS.RANGER_BRIEFED,
  },
  {
    id: 'prepare-team',
    number: 5,
    title: 'Prepara a tu equipo',
    description: 'Visita a la enfermera del camino norte antes de continuar.',
    requiresFlags: [STORY_FLAGS.RANGER_BRIEFED],
    completesOnFlag: STORY_FLAGS.FOREST_SUPPLIES_READY,
  },
  {
    id: 'defeat-north-rival',
    number: 6,
    title: 'Derrota al Rival del Norte',
    description: 'El entrenador rubio vigila el acceso al Bosque Esmeralda.',
    requiresFlags: [STORY_FLAGS.FOREST_SUPPLIES_READY],
    completesOnDefeatedNpc: 9,
  },
  {
    id: 'break-rock-gate',
    number: 7,
    title: 'Rompe la barrera de rocas',
    description: 'Ve al extremo norte de Tameria, mira hacia las rocas y pulsa ESPACIO.',
    requiresDefeatedNpcs: [9],
    completesOnFlag: STORY_FLAGS.ROCKS_CLEARED,
  },
  {
    id: 'enter-north-plaza',
    number: 8,
    title: 'Entra en la Plaza del Norte',
    description: 'Cruza el paso que acabas de abrir y explora la nueva ciudad.',
    requiresFlags: [STORY_FLAGS.ROCKS_CLEARED],
    completesOnArea: 'plaza_1',
  },
]);

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

export class QuestTracker {
  /** @type {Phaser.Scene} */
  #scene;
  /** @type {HTMLDivElement} */
  #root;
  /** @type {HTMLDivElement | undefined} */
  #card;
  /** @type {(typeof STORY_QUESTS)[number] | undefined} */
  #activeQuest;
  /** @type {boolean} */
  #destroyed;
  /** @type {number} */
  #transitionId;

  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.#scene = scene;
    this.#card = undefined;
    this.#activeQuest = undefined;
    this.#destroyed = false;
    this.#transitionId = 0;
    this.#root = document.createElement('div');
    this.#root.id = 'tameria-quest-tracker';
    Object.assign(this.#root.style, {
      position: 'fixed',
      top: '18px',
      left: '18px',
      zIndex: '999990',
      width: 'min(360px, calc(100vw - 36px))',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none',
      fontFamily: 'Kenney-Future-Narrow, monospace',
    });
    document.body.appendChild(this.#root);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** @param {{ animateCompletion?: boolean }} [options] */
  sync(options = {}) {
    if (this.#destroyed) {
      return;
    }
    const nextQuest = STORY_QUESTS.find((quest) => this.#requirementsMet(quest) && !this.#isComplete(quest));

    if (nextQuest?.id === this.#activeQuest?.id) {
      return;
    }
    if (this.#activeQuest && this.#isComplete(this.#activeQuest) && options.animateCompletion) {
      this.#completeAndReplace(nextQuest);
      return;
    }
    this.#replace(nextQuest);
  }

  /** @param {(typeof STORY_QUESTS)[number]} quest */
  #requirementsMet(quest) {
    const viewedEvents = new Set(dataManager.store.get(DATA_MANAGER_STORE_KEYS.VIEWED_EVENTS) || []);
    const flags = dataManager.getFlags();
    const defeatedNpcs = dataManager.getDefeatedNpcs();
    const currentArea = dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION)?.area;
    return (
      (quest.requiresEvents || []).every((eventId) => viewedEvents.has(eventId)) &&
      (quest.requiresFlags || []).every((flag) => flags.has(flag)) &&
      (quest.requiresDefeatedNpcs || []).every((npcId) => defeatedNpcs.has(npcId)) &&
      (quest.requiresArea === undefined || quest.requiresArea === currentArea)
    );
  }

  /** @param {(typeof STORY_QUESTS)[number]} quest */
  #isComplete(quest) {
    const viewedEvents = new Set(dataManager.store.get(DATA_MANAGER_STORE_KEYS.VIEWED_EVENTS) || []);
    const currentArea = dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION)?.area;
    return (
      (quest.completesOnEvent !== undefined && viewedEvents.has(quest.completesOnEvent)) ||
      (quest.completesOnFlag !== undefined && dataManager.getFlags().has(quest.completesOnFlag)) ||
      (quest.completesOnDefeatedNpc !== undefined &&
        dataManager.getDefeatedNpcs().has(quest.completesOnDefeatedNpc)) ||
      (quest.completesOnArea !== undefined && quest.completesOnArea === currentArea)
    );
  }

  /** @param {(typeof STORY_QUESTS)[number] | undefined} quest */
  #replace(quest) {
    this.#transitionId += 1;
    this.#card?.remove();
    this.#card = undefined;
    this.#activeQuest = quest;
    if (!quest) {
      return;
    }
    this.#card = this.#createCard(quest);
    this.#root.appendChild(this.#card);
    this.#card.animate(
      [
        { opacity: 0, transform: 'translateX(-115%) scale(0.96)' },
        { opacity: 1, transform: 'translateX(0) scale(1)' },
      ],
      { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }
    );
  }

  /** @param {(typeof STORY_QUESTS)[number] | undefined} nextQuest */
  async #completeAndReplace(nextQuest) {
    const transitionId = ++this.#transitionId;
    const card = this.#card;
    if (!card) {
      this.#replace(nextQuest);
      return;
    }
    card.dataset.state = 'complete';
    card.style.borderColor = '#c7ff00';
    card.style.boxShadow = '0 0 0 1px rgba(199,255,0,.35), 0 14px 36px rgba(0,0,0,.48), 0 0 28px rgba(199,255,0,.18)';
    const status = card.querySelector('[data-role="status"]');
    if (status) {
      status.textContent = '✓ COMPLETADA';
      status.style.color = '#c7ff00';
    }
    await card.animate(
      [
        { transform: 'translateX(0) scale(1)' },
        { transform: 'translateX(0) scale(1.025)' },
        { transform: 'translateX(0) scale(1)' },
      ],
      { duration: 420, easing: 'ease-out' }
    ).finished;
    await wait(650);
    if (this.#destroyed || transitionId !== this.#transitionId) {
      return;
    }
    await card.animate(
      [
        { opacity: 1, transform: 'translateX(0) scale(1)' },
        { opacity: 0, transform: 'translateX(-115%) scale(0.96)' },
      ],
      { duration: 380, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'both' }
    ).finished;
    if (this.#destroyed || transitionId !== this.#transitionId) {
      return;
    }
    card.remove();
    this.#card = undefined;
    this.#activeQuest = undefined;
    await wait(180);
    if (!this.#destroyed && transitionId === this.#transitionId) {
      this.#replace(nextQuest);
    }
  }

  /** @param {(typeof STORY_QUESTS)[number]} quest */
  #createCard(quest) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      position: 'relative',
      overflow: 'hidden',
      padding: '13px 15px 14px 58px',
      color: '#f8fafc',
      background: 'linear-gradient(135deg, rgba(9,14,12,.96), rgba(20,31,27,.94))',
      border: '1px solid rgba(199,255,0,.48)',
      borderLeft: '4px solid #c7ff00',
      borderRadius: '8px',
      boxShadow: '0 14px 36px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.05)',
      backdropFilter: 'blur(8px)',
    });
    card.innerHTML = `
      <div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,transparent 0 8px,rgba(199,255,0,.025) 8px 9px);pointer-events:none"></div>
      <div style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:31px;height:31px;border-radius:7px;display:grid;place-items:center;background:#c7ff00;color:#0a0d0b;font:900 17px monospace;box-shadow:0 0 18px rgba(199,255,0,.22)">${String(quest.number).padStart(2, '0')}</div>
      <div data-role="status" style="position:relative;color:#c7ff00;font:700 10px monospace;letter-spacing:.2em;margin-bottom:4px">MISIÓN DE HISTORIA</div>
      <div style="position:relative;font-size:18px;line-height:1.05;letter-spacing:.025em;text-shadow:0 2px 0 #000">${quest.title}</div>
      <div style="position:relative;margin-top:6px;color:#aebbb5;font:12px/1.3 monospace">${quest.description}</div>
    `;
    return card;
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#transitionId += 1;
    this.#root.remove();
    this.#card = undefined;
    this.#activeQuest = undefined;
  }
}
