export const SPECTATOR_ACTION = Object.freeze({
  MOVE: 'MOVE',
  ENTER_MAP: 'ENTER_MAP',
  INTERACT: 'INTERACT',
  MENU: 'MENU',
  EVENT: 'EVENT',
  ENCOUNTER: 'ENCOUNTER',
  PROGRESS: 'PROGRESS',
});

const SPECTATOR_ALLOWED_ACTIONS = new Set([
  SPECTATOR_ACTION.MOVE,
  SPECTATOR_ACTION.ENTER_MAP,
]);

export function isWorldActionAllowed(isSpectator, action) {
  return !isSpectator || SPECTATOR_ALLOWED_ACTIONS.has(action);
}
