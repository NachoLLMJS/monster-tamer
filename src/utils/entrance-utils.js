import { DIRECTION } from '../common/direction.js';

/**
 * Prevents the north-plaza transition from bypassing the physical rock gate.
 *
 * @param {string} currentArea
 * @param {string} targetArea
 * @param {boolean} rocksCleared
 * @returns {boolean}
 */
export function canUseEntrance(currentArea, targetArea, rocksCleared) {
  const isNorthRockGate = currentArea === 'main_1' && targetArea === 'plaza_1';
  return !isNorthRockGate || rocksCleared;
}

/**
 * Returns the grid position where the player should appear after using an entrance.
 * Building entrances always place the player one tile beyond the exit trigger so
 * approaching the exterior doorway from the side cannot leave them outside.
 *
 * @param {{x: number, y: number}} entranceObject
 * @param {import('../common/direction.js').Direction} direction
 * @param {boolean} isBuildingEntrance
 * @param {number} tileSize
 * @returns {{x: number, y: number}}
 */
export function getEntranceSpawnPosition(entranceObject, direction, isBuildingEntrance, tileSize) {
  const x = entranceObject.x;
  let y = entranceObject.y - tileSize;

  if (isBuildingEntrance || direction === DIRECTION.UP) {
    y -= tileSize;
  } else if (direction === DIRECTION.DOWN) {
    y += tileSize;
  }

  return { x, y };
}
